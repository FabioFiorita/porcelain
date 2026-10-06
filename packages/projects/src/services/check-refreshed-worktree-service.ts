import { CheckWorktreeOptions } from '../ports/check-worktree-options.ts';
import { Effect, Context, Layer, Clock, DateTime } from 'effect';
import { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import { WorktreeUnavailableError } from '../errors/worktree-unavailable-error.ts';
import {
  type CheckRefreshedWorktreeResult,
  type CheckWorktreeInput,
} from '../models/check-worktree.ts';
import { InventoryStore } from '../ports/inventory-store.ts';
import { WorktreeCatalogStore } from '../ports/worktree-catalog-store.ts';
import { checkedWorktree } from '../rules/checked-worktree.ts';

export class CheckRefreshedWorktreeService extends Context.Service<
  CheckRefreshedWorktreeService,
  {
    readonly execute: (
      input: CheckWorktreeInput,
    ) => Effect.Effect<
      CheckRefreshedWorktreeResult,
      WorktreeNotFoundError | WorktreeUnavailableError
    >;
  }
>()('@porcelain/projects/CheckRefreshedWorktreeService') {
  static readonly layer = Layer.effect(
    CheckRefreshedWorktreeService,
    Effect.gen(function* () {
      const catalogCapability = yield* WorktreeCatalogStore;
      const inventoryCapability = yield* InventoryStore;
      const clockCapability = yield* Clock.Clock;
      const optionsCapability = yield* CheckWorktreeOptions;

      return {
        execute: Effect.fn('CheckRefreshedWorktreeService.execute')(function* (
          input: CheckWorktreeInput,
        ): Effect.fn.Return<
          CheckRefreshedWorktreeResult,
          WorktreeNotFoundError | WorktreeUnavailableError
        > {
          const entry = catalogCapability.find({
            worktreeId: input.worktreeId,
          });
          const answer = checkedWorktree(
            input,
            entry,
            catalogCapability.listObservations(),
            entry && input.requireAvailableProject
              ? yield* inventoryCapability.find({
                  projectId: entry.worktree.projectId,
                })
              : undefined,
            {
              now: DateTime.formatIso(
                DateTime.makeUnsafe(yield* clockCapability.currentTimeMillis),
              ),
              staleAfterMs: optionsCapability.staleAfterMs,
            },
          );
          if (answer.kind === 'found') return answer.worktree;
          if (answer.kind === 'missing')
            return yield* Effect.fail(new WorktreeNotFoundError());
          return yield* Effect.fail(new WorktreeUnavailableError());
        }),
      };
    }),
  );
}
