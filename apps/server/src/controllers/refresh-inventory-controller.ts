import type {
  ListProjectWorktreesService,
  ListRegisteredProjectsService,
  MarkProjectsUnavailableService,
  RecordWorktreePresenceService,
  UpdateProjectAvailabilityService,
} from '@porcelain/projects/services';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class RefreshInventoryController {
  private readonly markProjectsUnavailable: MarkProjectsUnavailableService;
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly listProjectWorktrees: ListProjectWorktreesService;
  private readonly updateProjectAvailability: UpdateProjectAvailabilityService;
  private readonly recordWorktreePresence: RecordWorktreePresenceService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    markProjectsUnavailable: MarkProjectsUnavailableService,
    listRegisteredProjects: ListRegisteredProjectsService,
    listProjectWorktrees: ListProjectWorktreesService,
    updateProjectAvailability: UpdateProjectAvailabilityService,
    recordWorktreePresence: RecordWorktreePresenceService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.markProjectsUnavailable = markProjectsUnavailable;
    this.listRegisteredProjects = listRegisteredProjects;
    this.listProjectWorktrees = listProjectWorktrees;
    this.updateProjectAvailability = updateProjectAvailability;
    this.recordWorktreePresence = recordWorktreePresence;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
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
      },
      { callerSignal: context.signal },
    );
  }
}
