import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pullBranch } from './pull-branch.ts';

type Command = Parameters<typeof pullBranch>[1];
type Strategy = Command['intent']['strategy'];

let base: string;
let origin: string;
let upstream: string;
let clone: string;

const git = (dir: string, ...args: string[]) =>
  execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();

const repository = (dir: string) => {
  git(dir, 'config', 'user.name', 'T');
  git(dir, 'config', 'user.email', 't@e');
};

const commit = (dir: string, file: string, content: string) => {
  writeFileSync(join(dir, file), content);
  git(dir, 'add', file);
  git(dir, 'commit', '-q', '-m', `write ${file}`);
  return git(dir, 'rev-parse', 'HEAD');
};

const publish = (file: string, content: string) => {
  const oid = commit(upstream, file, content);
  git(upstream, 'push', '-q', 'origin', 'HEAD:refs/heads/main');
  return oid;
};

const runner: Parameters<typeof pullBranch>[0] = {
  execute: (args) => {
    const result = spawnSync('git', ['-C', clone, ...args], {
      env: { ...process.env, GIT_EDITOR: ':', GIT_TERMINAL_PROMPT: '0' },
    });
    return Promise.resolve({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.status,
      started: true,
      interrupted: false,
      descendantsStopped: true,
    });
  },
};

const remote = () => ({
  name: 'origin',
  url: origin,
  trackingRef: 'refs/remotes/origin/main',
  display: origin,
});

const preparation = (
  strategy?: Strategy,
  sourceRef = 'refs/heads/main',
): Command => ({
  id: 'pull-1',
  intent: {
    action: 'pull',
    remoteName: 'origin',
    sourceRef,
    strategy,
  },
  preview: {
    headOid: git(clone, 'rev-parse', 'HEAD'),
    branch: git(clone, 'symbolic-ref', 'HEAD'),
    staged: false,
    trackedChanges: false,
    untrackedCount: 0,
    inProgress: null,
    mergeHeadOid: null,
    destination: origin,
    trackingOid: git(clone, 'rev-parse', 'refs/remotes/origin/main'),
  },
});

const pull = (command: Command) =>
  pullBranch(runner, command, remote(), AbortSignal.timeout(10_000));

const head = () => git(clone, 'rev-parse', 'HEAD');

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'porcelain-pull-'));
  origin = join(base, 'origin.git');
  upstream = join(base, 'upstream');
  clone = join(base, 'clone');
  execFileSync('git', ['init', '-q', '-b', 'main', upstream]);
  repository(upstream);
  commit(upstream, 'a.txt', 'one\n');
  execFileSync('git', ['clone', '-q', '--bare', upstream, origin]);
  git(upstream, 'remote', 'add', 'origin', origin);
  execFileSync('git', ['clone', '-q', origin, clone]);
  repository(clone);
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('pullBranch', () => {
  it('fast-forwards the branch to the fetched commit and removes its temporary ref', async () => {
    const command = preparation();
    const published = publish('b.txt', 'bee\n');
    expect({
      outcome: await pull(command),
      head: head(),
      tracking: git(clone, 'rev-parse', 'refs/remotes/origin/main'),
      temporary: git(clone, 'for-each-ref', 'refs/porcelain'),
    }).toEqual({
      outcome: {
        state: 'succeeded',
        result: { headOid: published, trackingOid: published },
        refreshRequired: true,
      },
      head: published,
      tracking: published,
      temporary: '',
    });
  });

  it('reports no change when the branch already matches the remote', async () => {
    const before = head();
    expect(await pull(preparation())).toEqual({
      state: 'no-change',
      result: { headOid: before },
      refreshRequired: true,
    });
  });

  it.each<{ label: string; strategy: Strategy }>([
    { label: 'left to its default', strategy: undefined },
    { label: 'fast-forward only', strategy: 'ff-only' },
  ])(
    'refuses diverged histories when the strategy is $label and keeps the local commit',
    async ({ strategy }) => {
      const local = commit(clone, 'c.txt', 'sea\n');
      const command = preparation(strategy);
      publish('b.txt', 'bee\n');
      expect({ outcome: await pull(command), head: head() }).toEqual({
        outcome: {
          state: 'rejected',
          reason: 'NON_FAST_FORWARD',
          refreshRequired: true,
        },
        head: local,
      });
    },
  );

  it('merges diverged histories with the merge strategy', async () => {
    const local = commit(clone, 'c.txt', 'sea\n');
    const command = preparation('merge');
    const published = publish('b.txt', 'bee\n');
    const outcome = await pull(command);
    expect({
      outcome,
      parents: git(clone, 'rev-list', '--parents', '-n', '1', 'HEAD'),
    }).toEqual({
      outcome: {
        state: 'succeeded',
        result: { headOid: head(), trackingOid: published },
        refreshRequired: true,
      },
      parents: `${head()} ${local} ${published}`,
    });
  });

  it('replays local commits onto the fetched commit with the rebase strategy', async () => {
    commit(clone, 'c.txt', 'sea\n');
    const command = preparation('rebase');
    const published = publish('b.txt', 'bee\n');
    const outcome = await pull(command);
    expect({
      outcome,
      parents: git(clone, 'rev-list', '--parents', '-n', '1', 'HEAD'),
      subject: git(clone, 'log', '-1', '--format=%s'),
    }).toEqual({
      outcome: {
        state: 'succeeded',
        result: { headOid: head(), trackingOid: published },
        refreshRequired: true,
      },
      parents: `${head()} ${published}`,
      subject: 'write c.txt',
    });
  });

  it.each<{ strategy: Strategy }>([
    { strategy: 'merge' },
    { strategy: 'rebase' },
  ])(
    'reports no change with the $strategy strategy when the branch is already ahead of the remote',
    async ({ strategy }) => {
      const local = commit(clone, 'c.txt', 'sea\n');
      const tracking = git(clone, 'rev-parse', 'refs/remotes/origin/main');
      expect({
        outcome: await pull(preparation(strategy)),
        head: head(),
      }).toEqual({
        outcome: {
          state: 'no-change',
          result: { headOid: local, trackingOid: tracking },
          refreshRequired: true,
        },
        head: local,
      });
    },
  );

  it.each<{ strategy: Strategy; marker: string }>([
    { strategy: 'merge', marker: 'MERGE_HEAD' },
    { strategy: 'rebase', marker: 'rebase-merge' },
  ])(
    'reports a conflict with the $strategy strategy and leaves it for the user to resolve',
    async ({ strategy, marker }) => {
      commit(clone, 'a.txt', 'local\n');
      const command = preparation(strategy);
      const published = publish('a.txt', 'remote\n');
      expect({
        outcome: await pull(command),
        inProgress: existsSync(
          git(
            clone,
            'rev-parse',
            '--path-format=absolute',
            '--git-path',
            marker,
          ),
        ),
      }).toEqual({
        outcome: {
          state: 'conflicted',
          result: { trackingOid: published },
          refreshRequired: true,
        },
        inProgress: true,
      });
    },
  );

  it.each([
    {
      change: 'a commit made after the preview',
      alter: () => commit(clone, 'c.txt', 'sea\n'),
    },
    {
      change: 'a branch switched after the preview',
      alter: () => git(clone, 'switch', '-q', '-c', 'other'),
    },
    {
      change: 'an edit made after the preview',
      alter: () => writeFileSync(join(clone, 'a.txt'), 'edited\n'),
    },
    {
      change: 'a file created after the preview',
      alter: () => writeFileSync(join(clone, 'new.txt'), 'new\n'),
    },
  ])('refuses to integrate over $change', async ({ alter }) => {
    const command = preparation();
    publish('b.txt', 'bee\n');
    alter();
    const before = head();
    expect({ outcome: await pull(command), head: head() }).toEqual({
      outcome: {
        state: 'rejected',
        reason: 'STALE_PREPARATION',
        refreshRequired: true,
      },
      head: before,
    });
  });

  it('refuses a remote branch rewritten since the preview and keeps the tracking ref', async () => {
    const command = preparation();
    const tracking = command.preview.trackingOid;
    git(upstream, 'commit', '-q', '--amend', '-m', 'rewritten');
    git(upstream, 'push', '-q', '--force', 'origin', 'HEAD:refs/heads/main');
    expect({
      outcome: await pull(command),
      tracking: git(clone, 'rev-parse', 'refs/remotes/origin/main'),
      head: head(),
    }).toEqual({
      outcome: {
        state: 'rejected',
        reason: 'NON_FAST_FORWARD',
        refreshRequired: true,
      },
      tracking,
      head: tracking,
    });
  });

  it('reports an uncertain outcome when the remote branch cannot be fetched', async () => {
    const before = head();
    expect({
      outcome: await pull(preparation(undefined, 'refs/heads/missing')),
      head: head(),
    }).toMatchObject({
      outcome: { state: 'indeterminate', reason: 'GIT_REJECTED' },
      head: before,
    });
  });
});
