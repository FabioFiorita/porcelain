import { Effect, Context, Layer, Clock, DateTime } from 'effect';
import { type RecordWorktreeCatalogInput } from '../models/worktree-catalog.ts';
import { WorktreeCatalogStore } from '../ports/worktree-catalog-store.ts';
import { catalogSnapshot } from '../rules/worktree-catalog.ts';

export class RecordWorktreeCatalogService extends Context.Service<
  RecordWorktreeCatalogService,
  {
    readonly execute: (
      input: RecordWorktreeCatalogInput,
    ) => Effect.Effect<void, never>;
  }
>()('@porcelain/projects/RecordWorktreeCatalogService') {
  static readonly layer = Layer.effect(
    RecordWorktreeCatalogService,
    Effect.gen(function* () {
      const catalogCapability = yield* WorktreeCatalogStore;
      const clockCapability = yield* Clock.Clock;

      return {
        execute: Effect.fn('RecordWorktreeCatalogService.execute')(function* (
          input: RecordWorktreeCatalogInput,
        ): Effect.fn.Return<void, never> {
          const observedAt = DateTime.formatIso(
            DateTime.makeUnsafe(yield* clockCapability.currentTimeMillis),
          );
          return yield* Effect.sync<void>(() => {
            catalogCapability.save(
              catalogSnapshot(input.projects, input.listings, observedAt),
            );
          });
        }),
      };
    }),
  );
}
