import { Effect, Context, Layer } from 'effect';
import type { WorktreeActivityObservation } from '../models/worktree-activity.ts';
import { WorktreeCatalogStore } from '../ports/worktree-catalog-store.ts';
import { applyWorktreeActivity } from '../rules/worktree-activity.ts';

export class RecordWorktreeActivityService extends Context.Service<
  RecordWorktreeActivityService,
  {
    readonly execute: (input: {
      observations: readonly WorktreeActivityObservation[];
    }) => Effect.Effect<void, never>;
  }
>()('@porcelain/projects/RecordWorktreeActivityService') {
  static readonly layer = Layer.effect(
    RecordWorktreeActivityService,
    Effect.gen(function* () {
      const catalogCapability = yield* WorktreeCatalogStore;

      return {
        execute: Effect.fn('RecordWorktreeActivityService.execute')(
          function* (input: {
            observations: readonly WorktreeActivityObservation[];
          }): Effect.fn.Return<void, never> {
            yield* Effect.sync(() =>
              catalogCapability.save({
                projects: catalogCapability
                  .listObservations()
                  .map((observation) => ({
                    observation,
                    worktrees: applyWorktreeActivity(
                      catalogCapability.lastSeen({ projectId: observation.id }),
                      input.observations,
                    ),
                  })),
              }),
            );
          },
        ),
      };
    }),
  );
}
