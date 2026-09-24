import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyStash } from './apply-stash.ts';

type Runner = Parameters<typeof applyStash>[0];

const LINES = 'one\ntwo\nthree\nfour\nfive\n';

let checkout: string;

const git = (...args: string[]) =>
  execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' });

const refExists = (ref: string) =>
  spawnSync('git', ['-C', checkout, 'rev-parse', '--verify', '--quiet', ref])
    .status === 0;

const stashLog = () => git('stash', 'list', '--format=%H%x00%gd%x00%gs');

const stashes = () => git('stash', 'list', '--format=%H');

const runner: Runner = {
  execute: (args, signal, input, options) => {
    signal.throwIfAborted();
    const done = spawnSync('git', ['-C', checkout, ...args], {
      input,
      env: {
        ...process.env,
        LC_ALL: 'C',
        GIT_EDITOR: ':',
        ...(options?.indexFile === undefined
          ? {}
          : { GIT_INDEX_FILE: options.indexFile }),
      },
    });
    return Promise.resolve({
      stdout: done.stdout,
      stderr: done.stderr,
      exitCode: done.status,
      started: true,
      interrupted: done.status === null,
      descendantsStopped: true,
    });
  },
};

const apply = (
  stashOid: string,
  options: {
    action?: 'stash-apply' | 'stash-pop';
    restoreIndex?: boolean;
    log?: string;
  } = {},
) =>
  applyStash(
    runner,
    {
      id: 'req-2',
      intent: {
        action: options.action ?? 'stash-apply',
        stashOid,
        restoreIndex: options.restoreIndex ?? true,
      },
      preview: {
        headOid: git('rev-parse', 'HEAD').trim(),
        branch: 'refs/heads/main',
        staged: false,
        trackedChanges: false,
        untrackedCount: 0,
        stashOid,
      },
    },
    options.log ?? stashLog(),
    AbortSignal.timeout(10_000),
  );

const write = (path: string, content: string) => {
  writeFileSync(join(checkout, path), content);
};

const read = (path: string) => readFileSync(join(checkout, path), 'utf8');

const stash = (path: string, content: string) => {
  write(path, content);
  git('stash', 'push', '-q', '-m', `saved ${path}`);
  return git('rev-parse', 'refs/stash').trim();
};

const recordDiscard = (fields: Record<string, unknown>) => {
  const oid = execFileSync(
    'git',
    ['-C', checkout, 'hash-object', '-w', '--stdin'],
    {
      encoding: 'utf8',
      input: JSON.stringify({
        porcelainDiscard: 1,
        id: 'req-1',
        path: 'notes.txt',
        ...fields,
      }),
    },
  ).trim();
  git('update-ref', 'refs/porcelain/discarded/req-1', oid);
  return oid;
};

const discardHunk = () => {
  write('notes.txt', LINES.replace('two', 'TWO'));
  const unstaged = git(
    'diff',
    '--unified=0',
    '--no-ext-diff',
    '--',
    'notes.txt',
  );
  git('restore', 'notes.txt');
  return recordDiscard({ kind: 'hunk', cached: '', unstaged, zero: true });
};

beforeEach(() => {
  checkout = mkdtempSync(join(tmpdir(), 'porcelain-apply-stash-'));
  execFileSync('git', ['init', '-q', '-b', 'main', checkout]);
  git('config', 'user.name', 'T');
  git('config', 'user.email', 't@e');
  write('notes.txt', LINES);
  write('other.txt', 'other\n');
  git('add', '.');
  git('commit', '-q', '-m', 'base');
});

afterEach(() => {
  rmSync(checkout, { recursive: true, force: true });
});

describe('applyStash', () => {
  it('applies a stash and keeps its entry', async () => {
    const oid = stash('notes.txt', 'stashed\n');
    expect({
      outcome: await apply(oid),
      content: read('notes.txt'),
      stashes: stashes(),
    }).toEqual({
      outcome: {
        state: 'succeeded',
        result: { stashOid: oid, stashRetained: true },
        refreshRequired: true,
      },
      content: 'stashed\n',
      stashes: `${oid}\n`,
    });
  });

  it('brings staged changes back staged when asked to restore the index', async () => {
    write('notes.txt', 'staged\n');
    git('add', 'notes.txt');
    git('stash', 'push', '-q');
    await apply(git('rev-parse', 'refs/stash').trim(), { restoreIndex: true });
    expect(git('status', '--porcelain')).toBe('M  notes.txt\n');
  });

  it('brings staged changes back only to the worktree when not restoring the index', async () => {
    write('notes.txt', 'staged\n');
    git('add', 'notes.txt');
    git('stash', 'push', '-q');
    await apply(git('rev-parse', 'refs/stash').trim(), { restoreIndex: false });
    expect(git('status', '--porcelain')).toBe(' M notes.txt\n');
  });

  it('pops a stash by dropping only its own entry', async () => {
    const older = stash('notes.txt', 'older\n');
    const newer = stash('other.txt', 'newer\n');
    expect({
      outcome: await apply(older, { action: 'stash-pop' }),
      content: read('notes.txt'),
      stashes: stashes(),
    }).toEqual({
      outcome: {
        state: 'succeeded',
        result: { stashOid: older, stashRetained: false },
        refreshRequired: true,
      },
      content: 'older\n',
      stashes: `${newer}\n`,
    });
  });

  it('keeps the entry and reports an unknown outcome when the stash list changed since inspection', async () => {
    const older = stash('notes.txt', 'older\n');
    const log = stashLog();
    const newer = stash('other.txt', 'newer\n');
    expect({
      outcome: await apply(older, { action: 'stash-pop', log }),
      content: read('notes.txt'),
      stashes: stashes(),
    }).toEqual({
      outcome: {
        state: 'indeterminate',
        reason: 'OUTCOME_UNKNOWN',
        result: { stashOid: older, stashRetained: true },
        refreshRequired: true,
      },
      content: 'older\n',
      stashes: `${newer}\n${older}\n`,
    });
  });

  it('reports a conflict and keeps the stash when popping onto a conflicting commit', async () => {
    const oid = stash('notes.txt', 'stashed\n');
    write('notes.txt', 'committed\n');
    git('commit', '-q', '-am', 'conflicting');
    expect({
      outcome: await apply(oid, { action: 'stash-pop' }),
      unmerged: git('ls-files', '--unmerged', '--', 'notes.txt') !== '',
      stashes: stashes(),
    }).toMatchObject({
      outcome: {
        state: 'conflicted',
        result: { stashOid: oid, stashRetained: true },
        refreshRequired: true,
      },
      unmerged: true,
      stashes: `${oid}\n`,
    });
  });

  it('rejects applying over local changes to the same file and leaves them untouched', async () => {
    const oid = stash('notes.txt', 'stashed\n');
    write('notes.txt', 'local\n');
    expect({
      outcome: await apply(oid),
      content: read('notes.txt'),
    }).toMatchObject({
      outcome: {
        state: 'rejected',
        reason: 'GIT_REJECTED',
        result: { stashOid: oid, stashRetained: true },
      },
      content: 'local\n',
    });
  });

  it('refuses an object the repository does not have', async () => {
    await expect(apply('1'.repeat(40))).rejects.toMatchObject({
      name: 'GitActionRejectedError',
      reason: 'GIT_REJECTED',
    });
  });

  it('restores a discarded hunk from its recovery record and removes the record', async () => {
    const oid = discardHunk();
    expect({
      outcome: await apply(oid),
      content: read('notes.txt'),
      recorded: refExists('refs/porcelain/discarded/req-1'),
    }).toEqual({
      outcome: {
        state: 'succeeded',
        result: { stashOid: oid, stashRetained: false },
        refreshRequired: true,
      },
      content: LINES.replace('two', 'TWO'),
      recorded: false,
    });
  });

  it('restores a discarded rename to the index', async () => {
    git('mv', 'notes.txt', 'renamed.txt');
    const cached = git(
      'diff',
      '--cached',
      '--binary',
      '--full-index',
      '--',
      'notes.txt',
      'renamed.txt',
    );
    git('mv', 'renamed.txt', 'notes.txt');
    const oid = recordDiscard({ kind: 'rename', cached, unstaged: '' });
    await apply(oid);
    expect(git('status', '--porcelain')).toBe('R  notes.txt -> renamed.txt\n');
  });

  it('keeps the recovery record when its change no longer applies', async () => {
    const oid = discardHunk();
    write('notes.txt', LINES.replace('two', 'second'));
    git('commit', '-q', '-am', 'moved on');
    expect({
      outcome: await apply(oid),
      content: read('notes.txt'),
      recorded: refExists('refs/porcelain/discarded/req-1'),
    }).toMatchObject({
      outcome: {
        state: 'rejected',
        reason: 'GIT_REJECTED',
        result: { stashOid: oid, stashRetained: true },
      },
      content: LINES.replace('two', 'second'),
      recorded: true,
    });
  });

  it('rejects a blob that no recovery record points at', async () => {
    const oid = execFileSync(
      'git',
      ['-C', checkout, 'hash-object', '-w', '--stdin'],
      { encoding: 'utf8', input: 'loose\n' },
    ).trim();
    expect(await apply(oid)).toEqual({
      state: 'rejected',
      reason: 'GIT_REJECTED',
      message: 'The discarded hunk recovery object is no longer available.',
      refreshRequired: false,
    });
  });
});
