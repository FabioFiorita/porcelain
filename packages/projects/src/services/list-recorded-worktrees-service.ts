import { Effect, Context, Layer } from 'effect';
import { type RecordedWorktreesResult } from '../models/collect-absent-worktrees.ts';
import { InventoryStore } from '../ports/inventory-store.ts';
import { WorktreePresenceStore } from '../ports/worktree-presence-store.ts';
import { recordedWorktrees } from '../rules/worktree-presence.ts';

export class ListRecordedWorktreesService extends Context.Service<
  ListRecordedWorktreesService,
  { readonly execute: () => Effect.Effect<RecordedWorktreesResult, never> }
>()('@porcelain/projects/ListRecordedWorktreesService') {
  static readonly layer = Layer.effect(
    ListRecordedWorktreesService,
    Effect.gen(function* () {
      const worktreePresenceCapability = yield* WorktreePresenceStore;
      const inventoryCapability = yield* InventoryStore;

      return {
        execute: Effect.fn('ListRecordedWorktreesService.execute')(
          function* (): Effect.fn.Return<RecordedWorktreesResult, never> {
            return yield* Effect.sync<RecordedWorktreesResult>(() => {
              return {
                worktrees: recordedWorktrees(
                  worktreePresenceCapability.list(),
                  inventoryCapability.read().projects,
                ),
              };
            });
          },
        ),
      };
    }),
  );
}
