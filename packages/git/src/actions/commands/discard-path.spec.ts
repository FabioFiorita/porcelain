import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { discardPath } from './discard-path.ts';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';

type Runner = Parameters<typeof discardPath>[0];
type Hunk = Parameters<typeof discardPath>[1]['intent']['hunk'];

const LINES = 'one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\n';

let checkout: string;

const git = (...args: string[]) =>
  execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' });

const refExists = (ref: string) =>
  spawnSync('git', ['-C', checkout, 'rev-parse', '--verify', '--quiet', ref])
    .status === 0;

const runner: Runner = {
  limits: gitLimits,
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

const discard = (path: string, hunk?: Hunk) =>
  discardPath(
    runner,
    {
      id: 'req-1',
      intent: { action: 'discard', path, hunk },
      preview: {
        headOid: git('rev-parse', 'HEAD').trim(),
        branch: 'refs/heads/main',
        staged: false,
        trackedChanges: true,
        untrackedCount: 0,
      },
    },
    AbortSignal.timeout(10_000),
  );

const write = (path: string, content: string) => {
  writeFileSync(join(checkout, path), content);
};

const read = (path: string) => readFileSync(join(checkout, path), 'utf8');

beforeEach(() => {
  checkout = mkdtempSync(join(tmpdir(), 'porcelain-discard-path-'));
  execFileSync('git', ['init', '-q', '-b', 'main', checkout]);
  git('config', 'user.name', 'T');
  git('config', 'user.email', 't@e');
  write('notes.txt', LINES);
  write('other.txt', 'other\n');
  write('*.txt', 'star\n');
  git('add', '.');
  git('commit', '-q', '-m', 'base');
});

afterEach(() => {
  rmSync(checkout, { recursive: true, force: true });
});

describe('discardPath', () => {
  it('restores a file to HEAD and keeps its staged and unstaged changes in a retained stash', async () => {
    write('notes.txt', LINES.replace('two', 'TWO'));
    git('add', 'notes.txt');
    write('notes.txt', LINES.replace('two', 'TWO').replace('six', 'SIX'));
    const outcome = await discard('notes.txt');
    const stash = git('rev-parse', 'refs/stash').trim();
    expect({
      outcome,
      content: read('notes.txt'),
      status: git('status', '--porcelain'),
      stashed: git('show', `${stash}:notes.txt`),
      stashedIndex: git('show', `${stash}^2:notes.txt`),
    }).toEqual({
      outcome: {
        state: 'succeeded',
        result: {
          stashOid: stash,
          stashRetained: true,
          restoreStashOid: stash,
          restoreIndex: true,
        },
        refreshRequired: true,
      },
      content: LINES,
      status: '',
      stashed: LINES.replace('two', 'TWO').replace('six', 'SIX'),
      stashedIndex: LINES.replace('two', 'TWO'),
    });
  });

  it('leaves the changes of other files in place', async () => {
    write('notes.txt', 'changed\n');
    write('other.txt', 'other changed\n');
    await discard('notes.txt');
    expect(git('status', '--porcelain')).toBe(' M other.txt\n');
  });

  it('removes an untracked file and keeps it in the stash', async () => {
    write('draft.txt', 'draft\n');
    await discard('draft.txt');
    expect({
      exists: existsSync(join(checkout, 'draft.txt')),
      stashed: git('show', 'refs/stash^3:draft.txt'),
    }).toEqual({ exists: false, stashed: 'draft\n' });
  });

  it('treats glob characters in the path literally', async () => {
    write('*.txt', 'star changed\n');
    write('other.txt', 'other changed\n');
    await discard('*.txt');
    expect({
      star: read('*.txt'),
      status: git('status', '--porcelain'),
    }).toEqual({ star: 'star\n', status: ' M other.txt\n' });
  });

  it('reports no change and creates no stash for a path without changes', async () => {
    write('other.txt', 'other changed\n');
    expect({
      outcome: await discard('notes.txt'),
      stash: refExists('refs/stash'),
    }).toEqual({
      outcome: { state: 'no-change', refreshRequired: false },
      stash: false,
    });
  });

  it('rejects a path outside the checkout without touching the worktree', async () => {
    write('notes.txt', 'changed\n');
    expect({
      outcome: await discard('../outside.txt'),
      status: git('status', '--porcelain'),
    }).toMatchObject({
      outcome: { state: 'rejected', reason: 'GIT_REJECTED' },
      status: ' M notes.txt\n',
    });
  });

  it('undoes a staged rename named by its new path and keeps a recovery record', async () => {
    git('mv', 'notes.txt', 'renamed.txt');
    const outcome = await discard('renamed.txt');
    const recovery = git('rev-parse', 'refs/porcelain/discarded/req-1').trim();
    expect({
      outcome,
      notes: read('notes.txt'),
      renamed: existsSync(join(checkout, 'renamed.txt')),
      status: git('status', '--porcelain'),
      stash: refExists('refs/stash'),
      recorded: git('cat-file', '-t', recovery).trim(),
    }).toEqual({
      outcome: {
        state: 'succeeded',
        result: {
          restoreStashOid: recovery,
          stashRetained: true,
          restoreIndex: true,
        },
        refreshRequired: true,
      },
      notes: LINES,
      renamed: false,
      status: '',
      stash: false,
      recorded: 'blob',
    });
  });

  it('discards only the selected unstaged change and records it for recovery', async () => {
    write('notes.txt', LINES.replace('two', 'TWO').replace('eight', 'EIGHT'));
    const outcome = await discard('notes.txt', {
      scope: 'unstaged',
      startLine: 2,
      endLine: 2,
    });
    const recovery = git('rev-parse', 'refs/porcelain/discarded/req-1').trim();
    expect({ outcome, content: read('notes.txt') }).toEqual({
      outcome: {
        state: 'succeeded',
        result: { restoreStashOid: recovery, stashRetained: true },
        refreshRequired: true,
      },
      content: LINES.replace('eight', 'EIGHT'),
    });
  });

  it('discards a selected staged change from both the index and the worktree', async () => {
    write('notes.txt', LINES.replace('two', 'TWO'));
    git('add', 'notes.txt');
    await discard('notes.txt', { scope: 'staged', startLine: 2, endLine: 2 });
    expect({
      content: read('notes.txt'),
      status: git('status', '--porcelain'),
    }).toEqual({ content: LINES, status: '' });
  });

  it('refuses a selection that covers only part of a change and leaves the file alone', async () => {
    const changed = LINES.replace('two', 'TWO').replace('three', 'THREE');
    write('notes.txt', changed);
    await expect(
      discard('notes.txt', { scope: 'unstaged', startLine: 2, endLine: 2 }),
    ).rejects.toMatchObject({
      name: 'GitActionRejectedError',
      reason: 'UNSUPPORTED_CONFIGURATION',
    });
    expect(read('notes.txt')).toBe(changed);
  });

  it('reports a selection that matches no current change as changed since looked', async () => {
    write('notes.txt', LINES.replace('two', 'TWO'));
    await expect(
      discard('notes.txt', { scope: 'unstaged', startLine: 5, endLine: 5 }),
    ).rejects.toMatchObject({
      name: 'GitActionRejectedError',
      reason: 'CHANGED_SINCE_LOOKED',
    });
  });

  it('refuses a second hunk discard under the same request id and keeps the first recovery record', async () => {
    write('notes.txt', LINES.replace('two', 'TWO').replace('eight', 'EIGHT'));
    await discard('notes.txt', { scope: 'unstaged', startLine: 2, endLine: 2 });
    const first = git('rev-parse', 'refs/porcelain/discarded/req-1').trim();
    const outcome = await discard('notes.txt', {
      scope: 'unstaged',
      startLine: 8,
      endLine: 8,
    });
    expect({
      outcome,
      content: read('notes.txt'),
      recovery: git('rev-parse', 'refs/porcelain/discarded/req-1').trim(),
    }).toMatchObject({
      outcome: { state: 'rejected', reason: 'GIT_REJECTED' },
      content: LINES.replace('eight', 'EIGHT'),
      recovery: first,
    });
  });
});
