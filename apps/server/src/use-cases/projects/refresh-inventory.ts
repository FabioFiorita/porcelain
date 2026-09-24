import type {
  ListKnownWorktreesService,
  ListProjectWorktreesService,
  ListRegisteredProjectsService,
  MarkProjectsUnavailableService,
  RecordWorktreePresenceService,
  UpdateProjectAvailabilityService,
} from '@porcelain/projects/services';
import { knownWorktreesChanged } from '@porcelain/projects/rules';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class RefreshInventoryUseCase {
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly listKnownWorktrees: ListKnownWorktreesService;
  private readonly listProjectWorktrees: ListProjectWorktreesService;
  private readonly markProjectsUnavailable: MarkProjectsUnavailableService;
  private readonly updateProjectAvailability: UpdateProjectAvailabilityService;
  private readonly recordWorktreePresence: RecordWorktreePresenceService;
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
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(context: OperationContext): Promise<void> {
    const changed = await this.lanes.run(
      this.laneKeys.inventory(),
      'write',
      async ({ signal }) => {
        const inventory = this.listRegisteredProjects.execute();
        const before = this.listKnownWorktrees.execute(inventory).listings;
        const listings = await Promise.all(
          inventory.projects.map((project) =>
            this.listProjectWorktrees.execute({ project }, signal),
          ),
        );
        this.markProjectsUnavailable.execute();
        for (const worktrees of listings) {
          this.updateProjectAvailability.execute({ worktrees });
          this.recordWorktreePresence.execute({ worktrees });
        }
        const after = this.listKnownWorktrees.execute(
          this.listRegisteredProjects.execute(),
        ).listings;
        return knownWorktreesChanged(before, after);
      },
      { callerSignal: context.signal },
    );
    if (changed) this.events.inventoryChanged();
  }
}
