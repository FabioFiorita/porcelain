import { Context, Effect, Layer } from 'effect';
import type { WorktreeWrite } from '@porcelain/effects/worktree';
import type { WorktreeCleanupPlan } from '@porcelain/kernel/models';
import type { WorktreeCleanupTarget } from '../models/worktree-cleanup.ts';
import { WorktreeCleanupRefusedError } from '../errors/worktree-cleanup-refused-error.ts';
import { WorktreeCleaner } from '../ports/worktree-cleaner.ts';
export class DeleteWorktreeService extends Context.Service<
  DeleteWorktreeService,
  {
    readonly execute: (
      input: WorktreeCleanupTarget,
    ) => Effect.Effect<
      { deleted: boolean; plan: WorktreeCleanupPlan },
      WorktreeCleanupRefusedError,
      WorktreeWrite
    >;
  }
>()('@porcelain/git-actions/DeleteWorktreeService') {
  static readonly layer = Layer.effect(
    DeleteWorktreeService,
    Effect.gen(function* () {
      const cleaner = yield* WorktreeCleaner;
      return {
        execute: Effect.fn('DeleteWorktreeService.execute')(function* (input) {
          if (input.worktree.main)
            return yield* new WorktreeCleanupRefusedError({
              message: 'The main worktree cannot be deleted.',
            });
          if (
            !input.options.deleteWorktree &&
            !input.options.deleteLocalBranch &&
            !input.options.deleteRemoteBranch
          )
            return yield* new WorktreeCleanupRefusedError({
              message: 'Choose at least one item to delete.',
            });
          if (
            !input.worktree.branch &&
            (input.options.deleteLocalBranch ||
              input.options.deleteRemoteBranch)
          )
            return yield* new WorktreeCleanupRefusedError({
              message:
                'This worktree is detached. There is no checked-out branch to delete.',
            });
          const plan = yield* cleaner.execute(input);
          return { deleted: input.confirmation !== undefined, plan };
        }),
      };
    }),
  );
}
