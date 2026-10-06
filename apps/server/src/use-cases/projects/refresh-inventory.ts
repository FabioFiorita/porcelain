import { Effect, Context, Layer } from 'effect';
import { type ProjectNotFoundError } from '@porcelain/projects/errors';
import {
  ListKnownWorktreesService,
  ListProjectWorktreesService,
  ListRegisteredProjectsService,
  MarkProjectsUnavailableService,
  RecordWorktreeCatalogService,
  RecordWorktreePresenceService,
  UpdateProjectAvailabilityService,
} from '@porcelain/projects/services';
import { knownWorktreesChanged } from '@porcelain/projects/rules';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class RefreshInventoryUseCase extends Context.Service<
  RefreshInventoryUseCase,
  { readonly execute: () => Effect.Effect<void, ProjectNotFoundError> }
>()('@porcelain/server/RefreshInventoryUseCase') {
  static readonly layer = Layer.effect(
    RefreshInventoryUseCase,
    Effect.gen(function* () {
      const listRegisteredProjectsCapability =
        yield* ListRegisteredProjectsService;
      const listKnownWorktreesCapability = yield* ListKnownWorktreesService;
      const listProjectWorktreesCapability = yield* ListProjectWorktreesService;
      const markProjectsUnavailableCapability =
        yield* MarkProjectsUnavailableService;
      const updateProjectAvailabilityCapability =
        yield* UpdateProjectAvailabilityService;
      const recordWorktreePresenceCapability =
        yield* RecordWorktreePresenceService;
      const recordWorktreeCatalogCapability =
        yield* RecordWorktreeCatalogService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('RefreshInventoryUseCase.execute')(
          function* (): Effect.fn.Return<void, ProjectNotFoundError> {
            return yield* lanesCapability
              .run(laneKeysCapability.inventory(), 'write', () =>
                Effect.gen(function* () {
                  const inventory =
                    yield* listRegisteredProjectsCapability.execute();
                  const { listings: before } =
                    yield* listKnownWorktreesCapability.execute(inventory);
                  const listings = yield* Effect.forEach(
                    inventory.projects,
                    (project) =>
                      listProjectWorktreesCapability.execute({ project }),
                    { concurrency: 'unbounded' },
                  );
                  return yield* Effect.uninterruptible(
                    Effect.gen(function* () {
                      yield* markProjectsUnavailableCapability.execute();
                      for (const worktrees of listings) {
                        yield* updateProjectAvailabilityCapability.execute({
                          worktrees,
                        });
                        yield* recordWorktreePresenceCapability.execute({
                          worktrees,
                        });
                      }
                      yield* recordWorktreeCatalogCapability.execute({
                        projects: inventory.projects,
                        listings,
                      });
                      const refreshed =
                        yield* listRegisteredProjectsCapability.execute();
                      const { listings: after } =
                        yield* listKnownWorktreesCapability.execute(refreshed);
                      return knownWorktreesChanged(before, after);
                    }),
                  );
                }),
              )
              .pipe(
                Effect.flatMap((changed) =>
                  changed ? eventsCapability.inventoryChanged() : Effect.void,
                ),
              );
          },
        ),
      };
    }),
  );
}
