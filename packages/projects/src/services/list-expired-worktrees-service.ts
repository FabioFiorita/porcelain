import { CollectAbsentWorktreesOptions } from '../ports/collect-absent-worktrees-options.ts';
import { Effect, Context, Layer, Clock, DateTime } from 'effect';
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
      const clockCapability = yield* Clock.Clock;
      const optionsCapability = yield* CollectAbsentWorktreesOptions;

      return {
        execute: Effect.fn('ListExpiredWorktreesService.execute')(
          function* (): Effect.fn.Return<RecordedWorktreesResult, never> {
            const rows = yield* worktreePresenceCapability.list();
            const expiredIds = new Set(
              expired(
                rows,
                DateTime.formatIso(
                  DateTime.makeUnsafe(yield* clockCapability.currentTimeMillis),
                ),
                optionsCapability.graceMs,
              ),
            );
            return {
              worktrees: recordedWorktrees(
                rows.filter((row) => expiredIds.has(row.worktreeId)),
                (yield* inventoryCapability.read()).projects,
              ),
            };
          },
        ),
      };
    }),
  );
}
