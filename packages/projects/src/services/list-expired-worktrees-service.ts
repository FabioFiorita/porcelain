import { CollectAbsentWorktreesOptions } from '../ports/collect-absent-worktrees-options.ts';
import { Effect, Context, Layer } from 'effect';
import { Clock } from '@porcelain/kernel/ports';
import { type RecordedWorktreesResult } from '../models/collect-absent-worktrees.ts';
import { InventoryStore } from '../ports/inventory-store.ts';
import { WorktreePresenceStore } from '../ports/worktree-presence-store.ts';
import { expired, recordedWorktrees } from '../rules/worktree-presence.ts';

export class ListExpiredWorktreesService extends Context.Service<
  ListExpiredWorktreesService,
  { readonly execute: () => Effect.Effect<RecordedWorktreesResult, never> }
>()('@porcelain/projects/ListExpiredWorktreesService') {
  static readonly layer = Layer.effect(
    ListExpiredWorktreesService,
    Effect.gen(function* () {
      const worktreePresenceCapability = yield* WorktreePresenceStore;
      const inventoryCapability = yield* InventoryStore;
      const clockCapability = yield* Clock;
      const optionsCapability = yield* CollectAbsentWorktreesOptions;

      return {
        execute: Effect.fn('ListExpiredWorktreesService.execute')(
          function* (): Effect.fn.Return<RecordedWorktreesResult, never> {
            return yield* Effect.sync<RecordedWorktreesResult>(() => {
              const rows = worktreePresenceCapability.list();
              const expiredIds = new Set(
                expired(rows, clockCapability.now(), optionsCapability.graceMs),
              );
              return {
                worktrees: recordedWorktrees(
                  rows.filter((row) => expiredIds.has(row.worktreeId)),
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
