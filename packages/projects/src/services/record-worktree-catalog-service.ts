import { Effect, Context, Layer } from 'effect';
import { Clock } from '@porcelain/kernel/ports';
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
      const clockCapability = yield* Clock;

      return {
        execute: Effect.fn('RecordWorktreeCatalogService.execute')(function* (
          input: RecordWorktreeCatalogInput,
        ): Effect.fn.Return<void, never> {
          return yield* Effect.sync<void>(() => {
            catalogCapability.save(
              catalogSnapshot(
                input.projects,
                input.listings,
                clockCapability.now(),
              ),
            );
          });
        }),
      };
    }),
  );
}
