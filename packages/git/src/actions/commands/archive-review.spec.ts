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
import { archiveReview } from './archive-review.ts';
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
      const plan = await run(archiveReview(request, gitLimits));
      expect(plan.worktreePath).toBe(deleteWorktree ? tree : undefined);
      expect(plan.localBranch).toBe(deleteLocalBranch ? 'feature' : undefined);
      expect(plan.remoteBranch).toBe(
        deleteRemoteBranch ? 'origin/feature' : undefined,
      );
      await run(
        archiveReview(
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
it('requires explicit confirmation before discarding dirty files', async () => {
  writeFileSync(join(tree, 'untracked.txt'), 'unsaved');
  const plan = await run(archiveReview(input(), gitLimits));
  expect(plan.dirty).toBe(true);
  await expect(
    run(
      archiveReview(
        { ...input(), confirmation: { plan, discardChanges: false } },
        gitLimits,
      ),
    ),
  ).rejects.toThrow('Explicitly confirm');
  expect(existsSync(tree)).toBe(true);
  await run(
    archiveReview(
      { ...input(), confirmation: { plan, discardChanges: true } },
      gitLimits,
    ),
  );
  expect(existsSync(tree)).toBe(false);
});
it('warns about commits missing from the remote even with stale tracking refs', async () => {
  writeFileSync(join(tree, 'file.txt'), 'unpublished');
  git(tree, 'commit', '-qam', 'Unpushed');
  const plan = await run(archiveReview(input(), gitLimits));
  expect(plan.unpushed).toBe(true);
  await expect(
    run(
      archiveReview(
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
    const plan = await run(archiveReview(request, gitLimits));
    expect(plan).toMatchObject({
      mainCheckout: true,
      worktreePath: undefined,
      localBranch: undefined,
      remoteBranch: undefined,
    });
    await run(
      archiveReview(
        { ...request, confirmation: { plan, discardChanges: true } },
        gitLimits,
      ),
    );
    expect(existsSync(main)).toBe(true);
    expect(git(remote, 'show-ref', '--heads')).toContain('refs/heads/main');
  },
);
it('refuses a stale deletion confirmation without deleting anything', async () => {
  const plan = await run(archiveReview(input(), gitLimits));
  writeFileSync(join(tree, 'file.txt'), 'changed since dialog');
  await expect(
    run(
      archiveReview(
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
    const plan = await run(archiveReview(input(), gitLimits));
    writeFileSync(file, 'new dirty content after confirmation');
    await expect(
      run(
        archiveReview(
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
  const plan = await run(archiveReview(request, gitLimits));
  expect(plan).toMatchObject({
    worktreePath: undefined,
    localBranch: undefined,
    remoteBranch: undefined,
  });
  await expect(
    run(
      archiveReview(
        { ...request, confirmation: { plan, discardChanges: false } },
        gitLimits,
      ),
    ),
  ).resolves.toEqual(plan);
});
it('refuses a project repository replaced at the same path', async () => {
  await expect(
    run(
      archiveReview(
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
  const plan = await run(archiveReview(input(), gitLimits));
  expect(plan.dirty).toBe(false);
  const keep = await run(
    archiveReview(
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
    archiveReview(
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
  const plan = await run(archiveReview(request, gitLimits));
  expect(plan).toMatchObject({
    unpushed: false,
    remoteBranch: undefined,
    remoteBranchNote: 'origin/feature: already deleted on remote.',
  });
  await run(
    archiveReview(
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
  const plan = await run(archiveReview({ ...input(), mergedHead }, gitLimits));
  expect(plan.unpushed).toBe(true);
});
it('skips remote deletion without an upstream and distinguishes published commits', async () => {
  git(tree, 'branch', '--unset-upstream');
  const plan = await run(archiveReview(input(), gitLimits));
  expect(plan).toMatchObject({
    unpushed: false,
    remoteBranch: undefined,
    remoteBranchNote:
      'Remote branch deletion skipped: this branch has no upstream.',
  });
  await run(
    archiveReview(
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
  const plan = await run(archiveReview(input(), gitLimits));
  expect(plan.unpushed).toBe(true);
});
it('leaves both branches intact when removing a locked worktree fails', async () => {
  git(main, 'worktree', 'lock', tree);
  const plan = await run(archiveReview(input(), gitLimits));
  await expect(
    run(
      archiveReview(
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
  const plan = await run(archiveReview(input(), gitLimits));
  await expect(
    run(
      archiveReview(
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
  const remaining = await run(archiveReview(input(), gitLimits));
  expect(remaining.remoteBranch).toBe('origin/feature');
  await run(
    archiveReview(
      { ...input(), confirmation: { plan: remaining, discardChanges: false } },
      gitLimits,
    ),
  );
  expect(
    git(remote, 'for-each-ref', '--format=%(refname)', 'refs/heads/feature'),
  ).toBe('');
});
