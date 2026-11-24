import { Effect, Context, Layer } from 'effect';
import { type ProjectNotFoundError } from '@porcelain/projects/errors';
import {
  ListKnownWorktreesService,
  ListProjectWorktreesService,
  ListRegisteredProjectsService,
  ReadWorktreeActivityService,
  RecordWorktreeActivityService,
  RecordWorktreeCatalogService,
  RecordWorktreePresenceService,
  UpdateProjectAvailabilityService,
} from '@porcelain/projects/services';
import { knownWorktreesChange } from '@porcelain/projects/rules';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class ScanInventoryUseCase extends Context.Service<
  ScanInventoryUseCase,
  { readonly execute: () => Effect.Effect<void, ProjectNotFoundError> }
>()('@porcelain/server/ScanInventoryUseCase') {
  static readonly layer = Layer.effect(
    ScanInventoryUseCase,
    Effect.gen(function* () {
      const listRegisteredProjectsCapability =
        yield* ListRegisteredProjectsService;
      const listKnownWorktreesCapability = yield* ListKnownWorktreesService;
      const listProjectWorktreesCapability = yield* ListProjectWorktreesService;
      const updateProjectAvailabilityCapability =
        yield* UpdateProjectAvailabilityService;
      const recordWorktreePresenceCapability =
        yield* RecordWorktreePresenceService;
      const recordWorktreeCatalogCapability =
        yield* RecordWorktreeCatalogService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;
      const readWorktreeActivityCapability = yield* ReadWorktreeActivityService;
      const recordWorktreeActivityCapability =
        yield* RecordWorktreeActivityService;
      const eventsCapability = yield* EventPublisher;
      const readInventory = Effect.fn('ScanInventoryUseCase.readInventory')(
        function* () {
          const inventory = yield* listRegisteredProjectsCapability.execute();
          const { listings } =
            yield* listKnownWorktreesCapability.execute(inventory);
          return { inventory, listings };
        },
      );
      const announce = (change: 'inventory' | 'activity' | undefined) =>
        change === undefined
          ? Effect.void
          : eventsCapability.inventoryChanged(
              change === 'activity' ? 'activity' : undefined,
            );

      return {
        execute: Effect.fn('ScanInventoryUseCase.execute')(
          function* (): Effect.fn.Return<void, ProjectNotFoundError> {
            const listed = yield* lanesCapability.run(
              laneKeysCapability.inventory(),
              'write',
              () =>
                Effect.gen(function* () {
                  const { inventory, listings: before } =
                    yield* readInventory();
                  const listings = yield* Effect.forEach(
                    inventory.projects,
                    (project) =>
                      listProjectWorktreesCapability.execute({ project }),
                    { concurrency: 'unbounded' },
                  );
                  return yield* Effect.uninterruptible(
                    Effect.gen(function* () {
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
                      return {
                        change: knownWorktreesChange(before, after),
                        listings: after,
                      };
                    }),
                  );
                }),
            );
            yield* announce(listed.change);
            const observations = yield* readWorktreeActivityCapability.execute({
              listings: listed.listings,
            });
            if (observations.length === 0) return;
            const recorded = yield* lanesCapability.run(
              laneKeysCapability.inventory(),
              'write',
              () =>
                Effect.gen(function* () {
                  const { inventory, listings: before } =
                    yield* readInventory();
                  yield* recordWorktreeActivityCapability.execute({
                    observations,
                  });
                  const { listings: after } =
                    yield* listKnownWorktreesCapability.execute(inventory);
                  return knownWorktreesChange(before, after);
                }),
            );
            yield* announce(recorded);
          },
        ),
      };
    }),
  );
}
