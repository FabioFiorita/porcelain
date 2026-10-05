import { CollectAbsentWorktreesOptions } from '../ports/collect-absent-worktrees-options.ts';
import { Effect, Context, Layer } from 'effect';
import { type WorktreeKeys } from '@porcelain/kernel/models';
import { Clock } from '@porcelain/kernel/ports';
import { type CollectAbsentWorktreesResult } from '../models/collect-absent-worktrees.ts';
import { WorktreePresenceStore } from '../ports/worktree-presence-store.ts';
import { expired } from '../rules/worktree-presence.ts';

export class CollectAbsentWorktreesService extends Context.Service<
  CollectAbsentWorktreesService,
  {
    readonly execute: (
      input: WorktreeKeys,
    ) => Effect.Effect<CollectAbsentWorktreesResult, never>;
  }
>()('@porcelain/projects/CollectAbsentWorktreesService') {
  static readonly layer = Layer.effect(
    CollectAbsentWorktreesService,
    Effect.gen(function* () {
      const worktreePresenceCapability = yield* WorktreePresenceStore;
      const clockCapability = yield* Clock;
      const optionsCapability = yield* CollectAbsentWorktreesOptions;

      return {
        execute: Effect.fn('CollectAbsentWorktreesService.execute')(function* (
          input: WorktreeKeys,
        ): Effect.fn.Return<CollectAbsentWorktreesResult, never> {
          return yield* Effect.sync<CollectAbsentWorktreesResult>(() => {
            const named = new Set(input.worktreeIds);
            const collected = expired(
              worktreePresenceCapability
                .list()
                .filter((row) => named.has(row.worktreeId)),
              clockCapability.now(),
              optionsCapability.graceMs,
            );
            worktreePresenceCapability.remove({ worktreeIds: collected });
            return { collected };
          });
        }),
      };
    }),
  );
}
