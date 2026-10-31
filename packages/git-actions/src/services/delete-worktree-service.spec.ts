import { Effect, Layer } from 'effect';
import { withWriteLease } from '@porcelain/effects/worktree';
import { expect, it } from 'vitest';
import { WorktreeCleaner } from '../ports/worktree-cleaner.ts';
import { DeleteWorktreeService } from './delete-worktree-service.ts';
import type { WorktreeCleanupTarget } from '../models/worktree-cleanup.ts';
const target: WorktreeCleanupTarget = {
  worktree: {
    id: 'tree',
    path: '/project/topic',
    branch: 'refs/heads/topic',
    main: false,
    commonDirectory: '/project/.git',
    repositoryIdentity: 'repository',
    administrativeDirectory: '/project/.git/worktrees/topic',
  },
  options: {
    deleteWorktree: true,
    deleteLocalBranch: true,
    deleteRemoteBranch: false,
  },
};
const plan = {
  worktreePath: '/project/topic',
  localBranch: 'topic',
  mainCheckout: false,
  dirty: false,
  unpushed: false,
  fingerprint: 'snapshot',
};
function subject() {
  const calls: WorktreeCleanupTarget[] = [];
  const layer = DeleteWorktreeService.layer.pipe(
    Layer.provide(
      Layer.succeed(WorktreeCleaner, {
        execute: (input) => {
          calls.push(input);
          return Effect.succeed(plan);
        },
      }),
    ),
  );
  return {
    calls,
    read: (input: WorktreeCleanupTarget) =>
      Effect.runPromise(
        Effect.flatMap(DeleteWorktreeService, (service) =>
          withWriteLease('tree', service.execute(input)),
        ).pipe(Effect.provide(layer)),
      ),
  };
}
it.each([
  { ...target, worktree: { ...target.worktree, main: true } },
  {
    ...target,
    options: {
      deleteWorktree: false,
      deleteLocalBranch: false,
      deleteRemoteBranch: false,
    },
  },
  { ...target, worktree: { ...target.worktree, branch: undefined } },
])(
  'refuses protected or meaningless cleanup before invoking Git: %j',
  async (input) => {
    const s = subject();
    await expect(s.read(input)).rejects.toMatchObject({
      _tag: 'WorktreeCleanupRefusedError',
    });
    expect(s.calls).toEqual([]);
  },
);
it('previews and confirms exactly the one-off option and fingerprint snapshot without any settings service', async () => {
  const s = subject();
  expect(await s.read(target)).toEqual({ deleted: false, plan });
  const confirmed = { ...target, confirmation: { plan, discardChanges: true } };
  expect(await s.read(confirmed)).toEqual({ deleted: true, plan });
  expect(s.calls).toEqual([target, confirmed]);
});
