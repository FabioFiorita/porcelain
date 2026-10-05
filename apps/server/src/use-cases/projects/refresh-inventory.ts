import { Effect } from 'effect';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import type {
  ListKnownWorktreesService,
  ListProjectWorktreesService,
  ListRegisteredProjectsService,
  MarkProjectsUnavailableService,
  RecordWorktreeCatalogService,
  RecordWorktreePresenceService,
  UpdateProjectAvailabilityService,
} from '@porcelain/projects/services';
import { knownWorktreesChanged } from '@porcelain/projects/rules';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class RefreshInventoryUseCase {
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly listKnownWorktrees: ListKnownWorktreesService;
  private readonly listProjectWorktrees: ListProjectWorktreesService;
  private readonly markProjectsUnavailable: MarkProjectsUnavailableService;
  private readonly updateProjectAvailability: UpdateProjectAvailabilityService;
  private readonly recordWorktreePresence: RecordWorktreePresenceService;
  private readonly recordWorktreeCatalog: RecordWorktreeCatalogService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    listRegisteredProjects: ListRegisteredProjectsService,
    listKnownWorktrees: ListKnownWorktreesService,
    listProjectWorktrees: ListProjectWorktreesService,
    markProjectsUnavailable: MarkProjectsUnavailableService,
    updateProjectAvailability: UpdateProjectAvailabilityService,
    recordWorktreePresence: RecordWorktreePresenceService,
    recordWorktreeCatalog: RecordWorktreeCatalogService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.listRegisteredProjects = listRegisteredProjects;
    this.listKnownWorktrees = listKnownWorktrees;
    this.listProjectWorktrees = listProjectWorktrees;
    this.markProjectsUnavailable = markProjectsUnavailable;
    this.updateProjectAvailability = updateProjectAvailability;
    this.recordWorktreePresence = recordWorktreePresence;
    this.recordWorktreeCatalog = recordWorktreeCatalog;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  execute(): Effect.Effect<void, ProjectNotFoundError> {
    return this.lanes
      .run(this.laneKeys.inventory(), 'write', () =>
        Effect.gen({ self: this }, function* () {
          const inventory = yield* this.listRegisteredProjects.execute();
          const { listings: before } =
            yield* this.listKnownWorktrees.execute(inventory);
          const listings = yield* Effect.forEach(
            inventory.projects,
            (project) => this.listProjectWorktrees.execute({ project }),
            { concurrency: 'unbounded' },
          );
          return yield* Effect.uninterruptible(
            Effect.gen({ self: this }, function* () {
              yield* this.markProjectsUnavailable.execute();
              for (const worktrees of listings) {
                yield* this.updateProjectAvailability.execute({ worktrees });
                yield* this.recordWorktreePresence.execute({ worktrees });
              }
              yield* this.recordWorktreeCatalog.execute({
                projects: inventory.projects,
                listings,
              });
              const refreshed = yield* this.listRegisteredProjects.execute();
              const { listings: after } =
                yield* this.listKnownWorktrees.execute(refreshed);
              return knownWorktreesChanged(before, after);
            }),
          );
        }),
      )
      .pipe(
        Effect.map((changed) => {
          if (changed) this.events.inventoryChanged();
        }),
      );
  }
}
