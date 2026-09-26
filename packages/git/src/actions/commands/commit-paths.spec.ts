import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { commitPaths } from './commit-paths.ts';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';

type Runner = Parameters<typeof commitPaths>[0];
type Preview = Parameters<typeof commitPaths>[1]['preview'];

let checkout: string;

const git = (...args: string[]) =>
  execFileSync('git', ['-C', checkout, ...args], {
    encoding: 'utf8',
    stdio: 'pipe',
  });

const head = () => git('rev-parse', 'HEAD').trim();

const message = () =>
  git('cat-file', 'commit', 'HEAD').split('\n\n').slice(1).join('\n\n');

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

const preview = (): Preview => ({
  headOid: head(),
  branch: 'refs/heads/main',
  staged: true,
  trackedChanges: true,
  untrackedCount: 0,
});

const commit = (
  paths: string[],
  options: {
    action?: 'commit' | 'amend';
    text?: string;
    seen?: Preview;
    verifyTarget?: () => Promise<void>;
  } = {},
) =>
  commitPaths(
    runner,
    {
      id: 'req-1',
      intent:
        options.action === 'amend'
          ? { action: 'amend', message: options.text ?? 'amended', paths }
          : { action: 'commit', message: options.text ?? 'picked', paths },
      preview: options.seen ?? preview(),
    },
    paths,
    AbortSignal.timeout(20_000),
    options.verifyTarget,
  );

const write = (path: string, content: string) => {
  writeFileSync(join(checkout, path), content);
};

const initialise = () => {
  execFileSync('git', ['init', '-q', '-b', 'main', checkout]);
  git('config', 'user.name', 'T');
  git('config', 'user.email', 't@e');
};

beforeEach(() => {
  checkout = mkdtempSync(join(tmpdir(), 'porcelain-commit-paths-'));
  initialise();
  write('a.txt', 'a\n');
  write('b.txt', 'b\n');
  write('*.txt', 'star\n');
  git('add', '.');
  git('commit', '-q', '-m', 'base');
});

afterEach(() => {
  rmSync(checkout, { recursive: true, force: true });
});

describe('commitPaths', () => {
  it('commits only the named paths and leaves other staged changes staged', async () => {
    const base = head();
    write('a.txt', 'a changed\n');
    write('b.txt', 'b staged\n');
    git('add', 'b.txt');
    const outcome = await commit(['a.txt']);
    expect({
      outcome,
      parent: git('rev-parse', 'HEAD^').trim(),
      a: git('show', 'HEAD:a.txt'),
      b: git('show', 'HEAD:b.txt'),
      status: git('status', '--porcelain'),
    }).toEqual({
      outcome: {
        state: 'succeeded',
        result: { headOid: head() },
        refreshRequired: true,
      },
      parent: base,
      a: 'a changed\n',
      b: 'b\n',
      status: 'M  b.txt\n',
    });
  });

  it('keeps the message verbatim, comment-looking lines included', async () => {
    write('a.txt', 'a changed\n');
    await commit(['a.txt'], { text: '# heading\n\n  indented  \n' });
    expect(message()).toBe('# heading\n\n  indented  \n');
  });

  it('commits a named untracked file', async () => {
    write('new.txt', 'new\n');
    await commit(['new.txt']);
    expect({
      committed: git('show', 'HEAD:new.txt'),
      status: git('status', '--porcelain'),
    }).toEqual({ committed: 'new\n', status: '' });
  });

  it('commits the deletion of a named file removed from the worktree', async () => {
    rmSync(join(checkout, 'a.txt'));
    await commit(['a.txt']);
    expect({
      tree: git('ls-tree', '--name-only', 'HEAD'),
      status: git('status', '--porcelain'),
    }).toEqual({ tree: '*.txt\nb.txt\n', status: '' });
  });

  it('treats glob characters in paths literally', async () => {
    write('*.txt', 'star changed\n');
    write('a.txt', 'a changed\n');
    await commit(['*.txt']);
    expect({
      star: git('show', 'HEAD:*.txt'),
      status: git('status', '--porcelain'),
    }).toEqual({ star: 'star changed\n', status: ' M a.txt\n' });
  });

  it('reports no change and keeps HEAD when the named paths match HEAD', async () => {
    const base = head();
    write('b.txt', 'b changed\n');
    expect({ outcome: await commit(['a.txt']), head: head() }).toEqual({
      outcome: { state: 'no-change', refreshRequired: false },
      head: base,
    });
  });

  it('makes the first commit on an unborn branch', async () => {
    rmSync(checkout, { recursive: true, force: true });
    mkdirSync(checkout);
    initialise();
    write('first.txt', 'first\n');
    const outcome = await commit(['first.txt'], {
      seen: {
        headOid: null,
        branch: 'refs/heads/main',
        staged: false,
        trackedChanges: false,
        untrackedCount: 1,
      },
    });
    expect({
      outcome,
      tree: git('ls-tree', '--name-only', 'HEAD'),
    }).toEqual({
      outcome: {
        state: 'succeeded',
        result: { headOid: head() },
        refreshRequired: true,
      },
      tree: 'first.txt\n',
    });
  });

  it('commits exactly 2,000 named files', async () => {
    mkdirSync(join(checkout, 'many'));
    const paths = Array.from({ length: 2000 }, (_, index) => `many/${index}`);
    for (const path of paths) write(path, `${path}\n`);
    await commit(paths);
    expect(
      git('ls-tree', '-r', '--name-only', 'HEAD', 'many').split('\n').length -
        1,
    ).toBe(2000);
  });

  it('refuses more than 2,000 paths', async () => {
    const paths = Array.from({ length: 2001 }, (_, index) => `many/${index}`);
    await expect(commit(paths)).rejects.toMatchObject({
      name: 'GitActionRejectedError',
      reason: 'UNSUPPORTED_CONFIGURATION',
    });
  });

  it.each([
    ['an empty path', ''],
    ['an absolute path', '/etc/passwd'],
    ['a path leaving the checkout', '../outside.txt'],
    ['a path climbing through a folder', 'dir/../a.txt'],
    ['a path through the current folder', './a.txt'],
    ['a path with an empty segment', 'dir//a.txt'],
    ['a path with a trailing slash', 'dir/'],
    ['a path inside .git', '.git/config'],
    ['a path inside a nested .git', 'sub/.git/config'],
    ['a path with a NUL byte', 'a.txt\0b.txt'],
  ])('refuses %s', async (_label, path) => {
    const base = head();
    write('a.txt', 'a changed\n');
    await expect(commit([path])).rejects.toMatchObject({
      name: 'GitActionRejectedError',
      reason: 'UNSUPPORTED_CONFIGURATION',
    });
    expect(head()).toBe(base);
  });

  it('refuses a commit that names no paths outside a merge', async () => {
    await expect(commit([])).rejects.toMatchObject({
      name: 'GitActionRejectedError',
      reason: 'REQUEST_MISMATCH',
    });
  });

  it.each([
    ['HEAD moved', { headOid: '1'.repeat(40) }],
    ['the branch changed', { branch: 'refs/heads/other' }],
    ['the expected merge is gone', { inProgress: 'merge' as const }],
  ])(
    'reports a change since looked when %s, without committing',
    async (_label, drift) => {
      const base = head();
      write('a.txt', 'a changed\n');
      await expect(
        commit(['a.txt'], { seen: { ...preview(), ...drift } }),
      ).rejects.toMatchObject({
        name: 'GitActionRejectedError',
        reason: 'CHANGED_SINCE_LOOKED',
      });
      expect(head()).toBe(base);
    },
  );

  it('refuses while another process holds the index lock and leaves that lock alone', async () => {
    write('a.txt', 'a changed\n');
    writeFileSync(join(checkout, '.git', 'index.lock'), 'held');
    await expect(commit(['a.txt'])).rejects.toMatchObject({
      name: 'GitActionRejectedError',
      reason: 'CHECKOUT_BUSY',
    });
    expect(existsSync(join(checkout, '.git', 'index.lock'))).toBe(true);
  });

  it('refuses during a rebase and releases its index lock', async () => {
    write('a.txt', 'a changed\n');
    mkdirSync(join(checkout, '.git', 'rebase-merge'));
    await expect(commit(['a.txt'])).rejects.toMatchObject({
      name: 'GitActionRejectedError',
      reason: 'CHECKOUT_BUSY',
    });
    expect(existsSync(join(checkout, '.git', 'index.lock'))).toBe(false);
  });

  it('stops before committing when the target check fails', async () => {
    const base = head();
    write('a.txt', 'a changed\n');
    await expect(
      commit(['a.txt'], {
        verifyTarget: () => Promise.reject(new Error('target moved')),
      }),
    ).rejects.toThrow('target moved');
    expect({ head: head(), status: git('status', '--porcelain') }).toEqual({
      head: base,
      status: ' M a.txt\n',
    });
  });

  it('returns a hook rejection without committing or changing the index', async () => {
    const base = head();
    const hook = join(checkout, '.git', 'hooks', 'pre-commit');
    writeFileSync(hook, '#!/bin/sh\necho blocked >&2\nexit 1\n');
    chmodSync(hook, 0o755);
    write('a.txt', 'a changed\n');
    expect({
      outcome: await commit(['a.txt']),
      head: head(),
      status: git('status', '--porcelain'),
    }).toEqual({
      outcome: {
        state: 'rejected',
        reason: 'GIT_REJECTED',
        message: 'blocked',
        refreshRequired: true,
      },
      head: base,
      status: ' M a.txt\n',
    });
  });

  it('leaves no index lock or temporary index behind after git rejects the commit', async () => {
    const hook = join(checkout, '.git', 'hooks', 'pre-commit');
    writeFileSync(hook, '#!/bin/sh\nexit 1\n');
    chmodSync(hook, 0o755);
    write('a.txt', 'a changed\n');
    await commit(['a.txt']);
    expect(
      readdirSync(join(checkout, '.git')).filter(
        (entry) => entry === 'index.lock' || entry.startsWith('porcelain-'),
      ),
    ).toEqual([]);
  });

  it('amends HEAD with the named paths on top of the same parent', async () => {
    const base = head();
    write('a.txt', 'a second\n');
    git('commit', '-q', '-am', 'second');
    write('b.txt', 'b amended\n');
    await commit(['b.txt'], { action: 'amend', text: 'amended' });
    expect({
      parent: git('rev-parse', 'HEAD^').trim(),
      a: git('show', 'HEAD:a.txt'),
      b: git('show', 'HEAD:b.txt'),
      message: message(),
    }).toEqual({
      parent: base,
      a: 'a second\n',
      b: 'b amended\n',
      message: 'amended',
    });
  });

  it('rewords HEAD without taking staged changes when amending with no paths', async () => {
    const tree = git('rev-parse', 'HEAD^{tree}').trim();
    write('b.txt', 'b staged\n');
    git('add', 'b.txt');
    const outcome = await commit([], { action: 'amend', text: 'reworded' });
    expect({
      outcome,
      tree: git('rev-parse', 'HEAD^{tree}').trim(),
      message: message(),
      status: git('status', '--porcelain'),
    }).toEqual({
      outcome: {
        state: 'succeeded',
        result: { headOid: head() },
        refreshRequired: true,
      },
      tree,
      message: 'reworded',
      status: 'M  b.txt\n',
    });
  });

  it('concludes a merge in progress when no paths are named', async () => {
    git('switch', '-q', '-c', 'side');
    write('side.txt', 'side\n');
    git('add', 'side.txt');
    git('commit', '-q', '-m', 'side');
    const side = head();
    git('switch', '-q', 'main');
    write('a.txt', 'a main\n');
    git('commit', '-q', '-am', 'main');
    const main = head();
    git('merge', '-q', '--no-commit', '--no-ff', 'side');
    const outcome = await commit([], {
      text: 'merged',
      seen: { ...preview(), inProgress: 'merge', mergeHeadOid: side },
    });
    expect({
      outcome,
      parents: git('rev-list', '--parents', '-n', '1', 'HEAD').trim(),
      merging: existsSync(join(checkout, '.git', 'MERGE_HEAD')),
    }).toEqual({
      outcome: {
        state: 'succeeded',
        result: { headOid: head() },
        refreshRequired: true,
      },
      parents: `${head()} ${main} ${side}`,
      merging: false,
    });
  });
});
