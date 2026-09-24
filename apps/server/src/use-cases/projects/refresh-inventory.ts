import type {
  ListProjectWorktreesService,
  ListRegisteredProjectsService,
  MarkProjectsUnavailableService,
  RecordWorktreePresenceService,
  UpdateProjectAvailabilityService,
} from '@porcelain/projects/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class RefreshInventoryUseCase {
  private readonly markProjectsUnavailable: MarkProjectsUnavailableService;
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly listProjectWorktrees: ListProjectWorktreesService;
  private readonly updateProjectAvailability: UpdateProjectAvailabilityService;
  private readonly recordWorktreePresence: RecordWorktreePresenceService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    markProjectsUnavailable: MarkProjectsUnavailableService,
    listRegisteredProjects: ListRegisteredProjectsService,
    listProjectWorktrees: ListProjectWorktreesService,
    updateProjectAvailability: UpdateProjectAvailabilityService,
    recordWorktreePresence: RecordWorktreePresenceService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.markProjectsUnavailable = markProjectsUnavailable;
    this.listRegisteredProjects = listRegisteredProjects;
    this.listProjectWorktrees = listProjectWorktrees;
    this.updateProjectAvailability = updateProjectAvailability;
    this.recordWorktreePresence = recordWorktreePresence;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  execute(context: OperationContext): Promise<void> {
    return this.lanes.run(
      this.laneKeys.inventory(),
      'write',
      async ({ signal }) => {
        this.markProjectsUnavailable.execute();
        const { projects } = this.listRegisteredProjects.execute();
        const listings = await Promise.all(
          projects.map((project) =>
            this.listProjectWorktrees.execute({ project }, signal),
          ),
        );
        for (const worktrees of listings) {
          this.updateProjectAvailability.execute({ worktrees });
          this.recordWorktreePresence.execute({ worktrees });
        }
        this.events.inventoryChanged();
      },
      { callerSignal: context.signal },
    );
  }
}
