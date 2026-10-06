import { Effect, Context, Layer } from 'effect';
import { WorktreeChangedError } from '@porcelain/kernel/errors';
import { type ConfirmWorktreeInput } from '../models/check-worktree.ts';
import { WorktreeCatalogStore } from '../ports/worktree-catalog-store.ts';
import { sameWorktree } from '../rules/same-worktree.ts';

export class ConfirmWorktreeService extends Context.Service<
  ConfirmWorktreeService,
  {
    readonly execute: (
      input: ConfirmWorktreeInput,
    ) => Effect.Effect<void, WorktreeChangedError>;
  }
>()('@porcelain/projects/ConfirmWorktreeService') {
  static readonly layer = Layer.effect(
    ConfirmWorktreeService,
    Effect.gen(function* () {
      const catalogCapability = yield* WorktreeCatalogStore;

      return {
        execute: Effect.fn('ConfirmWorktreeService.execute')(function* (
          input: ConfirmWorktreeInput,
        ): Effect.fn.Return<void, WorktreeChangedError> {
          const current = catalogCapability.find({
            worktreeId: input.worktree.id,
          });
          if (!sameWorktree(input.worktree, current?.worktree))
            return yield* Effect.fail(new WorktreeChangedError());
        }),
      };
    }),
  );
}
