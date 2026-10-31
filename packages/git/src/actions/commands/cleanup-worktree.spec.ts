import { NodeServices } from '@effect/platform-node';
import { Effect, type FileSystem, type Path } from 'effect';
import type { ChildProcessSpawner } from 'effect/process';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupWorktree } from './cleanup-worktree.ts';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';
let root: string;
let main: string;
let tree: string;
let remote: string;
const git = (path: string, ...args: string[]) =>
  execFileSync('git', ['-C', path, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const run = <A, E>(
  effect: Effect.Effect<
    A,
    E,
    FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  >,
) => Effect.runPromise(effect.pipe(Effect.provide(NodeServices.layer)));
const options = {
  deleteWorktree: true,
  deleteLocalBranch: true,
  deleteRemoteBranch: true,
};
const input = () => ({
  commonDirectory: join(main, '.git'),
  worktreePath: tree,
  branch: 'feature',
  options,
});
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'porcelain-archive-'));
  main = join(root, 'main');
  tree = join(root, 'feature');
  remote = join(root, 'remote.git');
  execFileSync('git', ['init', '-q', '-b', 'main', main]);
  git(main, 'config', 'user.name', 'T');
  git(main, 'config', 'user.email', 't@e');
  writeFileSync(join(main, 'file.txt'), 'base\n');
  git(main, 'add', '.');
  git(main, 'commit', '-qm', 'Base');
  execFileSync('git', ['init', '-q', '--bare', remote]);
  git(main, 'remote', 'add', 'origin', remote);
  git(main, 'push', '-qu', 'origin', 'main');
  git(main, 'worktree', 'add', '-qb', 'feature', tree);
  git(tree, 'push', '-qu', 'origin', 'feature');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
const combinations = [
  [false, false, false],
  [false, false, true],
  [false, true, false],
  [false, true, true],
  [true, false, false],
  [true, false, true],
  [true, true, false],
  [true, true, true],
] as const;
describe('review archive deletion settings', () => {
  it.each(combinations)(
    'worktree=%s local=%s remote=%s',
    async (deleteWorktree, deleteLocalBranch, deleteRemoteBranch) => {
      const request = {
        ...input(),
        options: { deleteWorktree, deleteLocalBranch, deleteRemoteBranch },
      };
      const plan = await run(cleanupWorktree(request, gitLimits));
      expect(plan.worktreePath).toBe(deleteWorktree ? tree : undefined);
      expect(plan.localBranch).toBe(deleteLocalBranch ? 'feature' : undefined);
      expect(plan.remoteBranch).toBe(
        deleteRemoteBranch ? 'origin/feature' : undefined,
      );
      await run(
        cleanupWorktree(
          { ...request, confirmation: { plan, discardChanges: false } },
          gitLimits,
        ),
      );
      expect(existsSync(tree)).toBe(!deleteWorktree);
      expect(
        git(
          main,
          'for-each-ref',
          '--format=%(refname)',
          'refs/heads/feature',
        ) !== '',
      ).toBe(!deleteLocalBranch);
      expect(
        git(
          remote,
          'for-each-ref',
          '--format=%(refname)',
          'refs/heads/feature',
        ) !== '',
      ).toBe(!deleteRemoteBranch);
      expect(existsSync(main)).toBe(true);
    },
  );
});
describe.each([true, false])('push remote reachable=%s', (reachable) => {
  it.each(combinations)(
    'preserves archive safety with worktree=%s local=%s remote=%s',
    async (deleteWorktree, deleteLocalBranch, deleteRemoteBranch) => {
      writeFileSync(join(tree, 'file.txt'), 'local commit\n');
      git(tree, 'commit', '-qam', 'Local only');
      writeFileSync(join(tree, 'unsaved.txt'), 'unsaved work\n');
      const request = {
        ...input(),
        options: { deleteWorktree, deleteLocalBranch, deleteRemoteBranch },
      };
      const cleanup = deleteWorktree || deleteLocalBranch || deleteRemoteBranch;
      const unavailable = join(root, 'unavailable.git');
      if (!reachable)
        git(main, 'remote', 'set-url', '--push', 'origin', unavailable);
      if (!reachable && cleanup) {
        await expect(
          run(cleanupWorktree(request, gitLimits)),
        ).rejects.toThrow();
        expect(existsSync(tree)).toBe(true);
        expect(git(main, 'rev-parse', 'feature')).toBe(
          git(tree, 'rev-parse', 'HEAD'),
        );
        expect(git(remote, 'log', '-1', '--format=%s', 'feature')).toBe('Base');
        git(main, 'remote', 'set-url', '--push', 'origin', remote);
      }
      const plan = await run(cleanupWorktree(request, gitLimits));
      expect(plan.unpushed).toBe(cleanup);
      expect(plan.dirty).toBe(deleteWorktree);
      if (cleanup) {
        await expect(
          run(
            cleanupWorktree(
              { ...request, confirmation: { plan, discardChanges: false } },
              gitLimits,
            ),
          ),
        ).rejects.toThrow('Explicitly confirm');
        expect(existsSync(tree)).toBe(true);
      } else {
        git(main, 'remote', 'set-url', '--push', 'origin', unavailable);
      }
      await run(
        cleanupWorktree(
          { ...request, confirmation: { plan, discardChanges: cleanup } },
          gitLimits,
        ),
      );
      expect(existsSync(tree)).toBe(!deleteWorktree);
      expect(
        git(
          main,
          'for-each-ref',
          '--format=%(refname)',
          'refs/heads/feature',
        ) !== '',
      ).toBe(!deleteLocalBranch);
      expect(
        git(
          remote,
          'for-each-ref',
          '--format=%(refname)',
          'refs/heads/feature',
        ) !== '',
      ).toBe(!deleteRemoteBranch);
      if (!deleteWorktree) {
        expect(git(tree, 'log', '-1', '--format=%s')).toBe('Local only');
        expect(existsSync(join(tree, 'unsaved.txt'))).toBe(true);
        expect(git(tree, 'branch', '--show-current')).toBe(
          deleteLocalBranch ? '' : 'feature',
        );
      }
    },
  );
});
it('requires explicit confirmation before discarding dirty files', async () => {
  writeFileSync(join(tree, 'untracked.txt'), 'unsaved');
  const plan = await run(cleanupWorktree(input(), gitLimits));
  expect(plan.dirty).toBe(true);
  await expect(
    run(
      cleanupWorktree(
        { ...input(), confirmation: { plan, discardChanges: false } },
        gitLimits,
      ),
    ),
  ).rejects.toThrow('Explicitly confirm');
  expect(existsSync(tree)).toBe(true);
  await run(
    cleanupWorktree(
      { ...input(), confirmation: { plan, discardChanges: true } },
      gitLimits,
    ),
  );
  expect(existsSync(tree)).toBe(false);
});
it('warns about commits missing from the remote even with stale tracking refs', async () => {
  writeFileSync(join(tree, 'file.txt'), 'unpublished');
  git(tree, 'commit', '-qam', 'Unpushed');
  const plan = await run(cleanupWorktree(input(), gitLimits));
  expect(plan.unpushed).toBe(true);
  await expect(
    run(
      cleanupWorktree(
        { ...input(), confirmation: { plan, discardChanges: false } },
        gitLimits,
      ),
    ),
  ).rejects.toThrow('Explicitly confirm');
  expect(git(tree, 'log', '-1', '--format=%s')).toBe('Unpushed');
});
it.each(combinations)(
  'protects main with worktree=%s local=%s remote=%s',
  async (deleteWorktree, deleteLocalBranch, deleteRemoteBranch) => {
    const request = {
      ...input(),
      worktreePath: main,
      branch: 'main',
      options: { deleteWorktree, deleteLocalBranch, deleteRemoteBranch },
    };
    const plan = await run(cleanupWorktree(request, gitLimits));
    expect(plan).toMatchObject({
      mainCheckout: true,
      worktreePath: undefined,
      localBranch: undefined,
      remoteBranch: undefined,
    });
    await run(
      cleanupWorktree(
        { ...request, confirmation: { plan, discardChanges: true } },
        gitLimits,
      ),
    );
    expect(existsSync(main)).toBe(true);
    expect(git(remote, 'show-ref', '--heads')).toContain('refs/heads/main');
  },
);
it('refuses a stale deletion confirmation without deleting anything', async () => {
  const plan = await run(cleanupWorktree(input(), gitLimits));
  writeFileSync(join(tree, 'file.txt'), 'changed since dialog');
  await expect(
    run(
      cleanupWorktree(
        { ...input(), confirmation: { plan, discardChanges: true } },
        gitLimits,
      ),
    ),
  ).rejects.toThrow('changed');
  expect(existsSync(tree)).toBe(true);
  expect(git(remote, 'show-ref', '--heads')).toContain('refs/heads/feature');
});
it.each(['tracked', 'untracked'] as const)(
  'rejects a changed %s file even when porcelain status is unchanged',
  async (kind) => {
    const file = join(tree, kind === 'tracked' ? 'file.txt' : 'new.txt');
    writeFileSync(file, 'first dirty content');
    const plan = await run(cleanupWorktree(input(), gitLimits));
    writeFileSync(file, 'new dirty content after confirmation');
    await expect(
      run(
        cleanupWorktree(
          { ...input(), confirmation: { plan, discardChanges: true } },
          gitLimits,
        ),
      ),
    ).rejects.toThrow('changed');
    expect(existsSync(tree)).toBe(true);
    expect(git(remote, 'show-ref', '--heads')).toContain('refs/heads/feature');
  },
);
it('archives after the worktree and local branch have already been removed', async () => {
  git(main, 'worktree', 'remove', tree);
  git(main, 'branch', '-D', 'feature');
  const request = {
    ...input(),
    options: {
      deleteWorktree: false,
      deleteLocalBranch: false,
      deleteRemoteBranch: false,
    },
  };
  const plan = await run(cleanupWorktree(request, gitLimits));
  expect(plan).toMatchObject({
    worktreePath: undefined,
    localBranch: undefined,
    remoteBranch: undefined,
  });
  await expect(
    run(
      cleanupWorktree(
        { ...request, confirmation: { plan, discardChanges: false } },
        gitLimits,
      ),
    ),
  ).resolves.toEqual(plan);
});
it('refuses a project repository replaced at the same path', async () => {
  await expect(
    run(
      cleanupWorktree(
        { ...input(), repositoryIdentity: 'another-repository' },
        gitLimits,
      ),
    ),
  ).rejects.toThrow('project repository changed');
  expect(existsSync(tree)).toBe(true);
  expect(git(remote, 'show-ref', '--heads')).toContain('refs/heads/feature');
});

it('ignores a large node_modules in fast previews and confirmation', async () => {
  writeFileSync(join(main, '.git/info/exclude'), 'node_modules/\n');
  const modules = join(tree, 'node_modules');
  mkdirSync(modules);
  for (let i = 0; i < 91_000; i++)
    writeFileSync(
      join(modules, `${'dependency-'.repeat(7)}${i}.js`),
      'ignored',
    );
  const plan = await run(cleanupWorktree(input(), gitLimits));
  expect(plan.dirty).toBe(false);
  const keep = await run(
    cleanupWorktree(
      {
        ...input(),
        options: {
          deleteWorktree: false,
          deleteLocalBranch: false,
          deleteRemoteBranch: false,
        },
      },
      gitLimits,
    ),
  );
  expect(keep.dirty).toBe(false);
  writeFileSync(join(modules, 'changed-after-preview.js'), 'ignored too');
  await run(
    cleanupWorktree(
      { ...input(), confirmation: { plan, discardChanges: false } },
      gitLimits,
    ),
  );
  expect(existsSync(tree)).toBe(false);
}, 30_000);
it('uses the merged PR head when GitHub already deleted the remote branch', async () => {
  const mergedHead = git(tree, 'rev-parse', 'HEAD');
  git(tree, 'push', 'origin', '--delete', 'feature');
  const request = { ...input(), mergedHead };
  const plan = await run(cleanupWorktree(request, gitLimits));
  expect(plan).toMatchObject({
    unpushed: false,
    remoteBranch: undefined,
    remoteBranchNote: 'origin/feature: already deleted on remote.',
  });
  await run(
    cleanupWorktree(
      { ...request, confirmation: { plan, discardChanges: false } },
      gitLimits,
    ),
  );
  expect(existsSync(tree)).toBe(false);
});
it('still warns for commits newer than the merged PR head after remote deletion', async () => {
  const mergedHead = git(tree, 'rev-parse', 'HEAD');
  git(tree, 'push', 'origin', '--delete', 'feature');
  writeFileSync(join(tree, 'file.txt'), 'after merge');
  git(tree, 'commit', '-qam', 'After merge');
  const plan = await run(
    cleanupWorktree({ ...input(), mergedHead }, gitLimits),
  );
  expect(plan.unpushed).toBe(true);
});
it('skips remote deletion without an upstream and distinguishes published commits', async () => {
  git(tree, 'branch', '--unset-upstream');
  const plan = await run(cleanupWorktree(input(), gitLimits));
  expect(plan).toMatchObject({
    unpushed: false,
    remoteBranch: undefined,
    remoteBranchNote:
      'Remote branch deletion skipped: this branch has no upstream.',
  });
  await run(
    cleanupWorktree(
      { ...input(), confirmation: { plan, discardChanges: false } },
      gitLimits,
    ),
  );
  expect(existsSync(tree)).toBe(false);
  expect(git(remote, 'show-ref', '--heads')).toContain('refs/heads/feature');
});
it('warns about genuinely unpublished commits without an upstream', async () => {
  git(tree, 'branch', '--unset-upstream');
  writeFileSync(join(tree, 'file.txt'), 'not published');
  git(tree, 'commit', '-qam', 'Local only');
  const plan = await run(cleanupWorktree(input(), gitLimits));
  expect(plan.unpushed).toBe(true);
});
it('leaves both branches intact when removing a locked worktree fails', async () => {
  git(main, 'worktree', 'lock', tree);
  const plan = await run(cleanupWorktree(input(), gitLimits));
  await expect(
    run(
      cleanupWorktree(
        { ...input(), confirmation: { plan, discardChanges: false } },
        gitLimits,
      ),
    ),
  ).rejects.toThrow(
    `Deleted: nothing. Not deleted: worktree ${tree}, local branch feature, remote branch origin/feature`,
  );
  expect(existsSync(tree)).toBe(true);
  expect(git(main, 'show-ref', '--verify', 'refs/heads/feature')).toBeTruthy();
  expect(
    git(remote, 'show-ref', '--verify', 'refs/heads/feature'),
  ).toBeTruthy();
});
it('reports completed local cleanup when the remote rejects deletion and can retry', async () => {
  writeFileSync(join(remote, 'hooks/pre-receive'), '#!/bin/sh\nexit 1\n', {
    mode: 0o755,
  });
  const plan = await run(cleanupWorktree(input(), gitLimits));
  await expect(
    run(
      cleanupWorktree(
        { ...input(), confirmation: { plan, discardChanges: false } },
        gitLimits,
      ),
    ),
  ).rejects.toThrow(
    `Deleted: worktree ${tree}, local branch feature. Not deleted: remote branch origin/feature`,
  );
  expect(existsSync(tree)).toBe(false);
  expect(
    git(main, 'for-each-ref', '--format=%(refname)', 'refs/heads/feature'),
  ).toBe('');
  expect(
    git(remote, 'show-ref', '--verify', 'refs/heads/feature'),
  ).toBeTruthy();
  rmSync(join(remote, 'hooks/pre-receive'));
  const remaining = await run(cleanupWorktree(input(), gitLimits));
  expect(remaining.remoteBranch).toBe('origin/feature');
  await run(
    cleanupWorktree(
      { ...input(), confirmation: { plan: remaining, discardChanges: false } },
      gitLimits,
    ),
  );
  expect(
    git(remote, 'for-each-ref', '--format=%(refname)', 'refs/heads/feature'),
  ).toBe('');
});
it.each([
  [false, true, false],
  [false, false, true],
  [false, true, true],
  [true, true, false],
  [true, false, true],
  [true, true, true],
])(
  'protects the actual remote default after main switches away: unset-upstream=%s local=%s remote=%s',
  async (unsetUpstream, deleteLocalBranch, deleteRemoteBranch) => {
    git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
    git(main, 'switch', '-c', 'other-main');
    git(tree, 'switch', 'main');
    if (unsetUpstream) git(tree, 'branch', '--unset-upstream', 'main');
    await expect(
      run(
        cleanupWorktree(
          {
            ...input(),
            branch: 'main',
            options: {
              deleteWorktree: true,
              deleteLocalBranch,
              deleteRemoteBranch,
            },
          },
          gitLimits,
        ),
      ),
    ).rejects.toThrow('The remote default branch is protected');
    expect(existsSync(tree)).toBe(true);
    const request = {
      ...input(),
      branch: 'main',
      options: {
        deleteWorktree: true,
        deleteLocalBranch: false,
        deleteRemoteBranch: false,
      },
    };
    const plan = await run(cleanupWorktree(request, gitLimits));
    expect(plan).toMatchObject({ worktreePath: tree, unpushed: false });
    await run(
      cleanupWorktree(
        { ...request, confirmation: { plan, discardChanges: false } },
        gitLimits,
      ),
    );
    expect(existsSync(tree)).toBe(false);
    expect(git(main, 'rev-parse', 'main')).toBe(
      git(remote, 'rev-parse', 'main'),
    );
  },
);
it('cleans a detached worktree without pretending to delete its previous branch', async () => {
  git(tree, 'switch', '--detach', '-q');
  const request = {
    ...input(),
    branch: undefined,
    options: {
      deleteWorktree: true,
      deleteLocalBranch: false,
      deleteRemoteBranch: false,
    },
  };
  const plan = await run(cleanupWorktree(request, gitLimits));
  expect(plan).toMatchObject({
    worktreePath: tree,
    dirty: false,
    unpushed: false,
    mainCheckout: false,
  });
  expect(plan.localBranch).toBeUndefined();
  expect(plan.remoteBranch).toBeUndefined();
  await run(
    cleanupWorktree(
      { ...request, confirmation: { plan, discardChanges: false } },
      gitLimits,
    ),
  );
  expect(existsSync(tree)).toBe(false);
  expect(git(main, 'rev-parse', 'feature')).toBe(
    git(remote, 'rev-parse', 'feature'),
  );
});
it('requires explicit acknowledgement for unpublished detached commits before deleting the checkout', async () => {
  git(tree, 'switch', '--detach', '-q');
  writeFileSync(join(tree, 'file.txt'), 'detached local commit\n');
  git(tree, 'commit', '-qam', 'Unpublished detached work');
  const request = {
    ...input(),
    branch: undefined,
    options: {
      deleteWorktree: true,
      deleteLocalBranch: false,
      deleteRemoteBranch: false,
    },
  };
  const plan = await run(cleanupWorktree(request, gitLimits));
  expect(plan.unpushed).toBe(true);
  await expect(
    run(
      cleanupWorktree(
        { ...request, confirmation: { plan, discardChanges: false } },
        gitLimits,
      ),
    ),
  ).rejects.toThrow('Explicitly confirm');
  expect(existsSync(tree)).toBe(true);
  await run(
    cleanupWorktree(
      { ...request, confirmation: { plan, discardChanges: true } },
      gitLimits,
    ),
  );
  expect(existsSync(tree)).toBe(false);
});

it.each([false, true])(
  'protects a default branch on a second push destination: unset-upstream=%s',
  async (unsetUpstream) => {
    const second = join(root, 'second.git');
    execFileSync('git', ['clone', '-q', '--bare', main, second]);
    git(second, 'symbolic-ref', 'HEAD', 'refs/heads/feature');
    git(main, 'config', '--add', 'remote.origin.pushurl', remote);
    git(main, 'config', '--add', 'remote.origin.pushurl', second);
    if (unsetUpstream) git(tree, 'branch', '--unset-upstream', 'feature');
    await expect(
      run(
        cleanupWorktree(
          {
            ...input(),
            options: {
              deleteWorktree: true,
              deleteLocalBranch: true,
              deleteRemoteBranch: false,
            },
          },
          gitLimits,
        ),
      ),
    ).rejects.toThrow('The remote default branch is protected');
    expect(existsSync(tree)).toBe(true);
    expect(git(main, 'rev-parse', 'feature')).toBe(
      git(second, 'rev-parse', 'feature'),
    );
  },
);
