import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import type {
  ComposeInventoryService,
  ListProjectWorktreesService,
  ListRegisteredProjectsService,
  ReadWorktreeStatusesService,
  RecordWorktreePresenceService,
  UpdateProjectAvailabilityService,
} from '@porcelain/projects/services';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class ReadInventoryController {
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly listProjectWorktrees: ListProjectWorktreesService;
  private readonly updateProjectAvailability: UpdateProjectAvailabilityService;
  private readonly recordWorktreePresence: RecordWorktreePresenceService;
  private readonly readWorktreeStatuses: ReadWorktreeStatusesService;
  private readonly composeInventory: ComposeInventoryService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    listRegisteredProjects: ListRegisteredProjectsService,
    listProjectWorktrees: ListProjectWorktreesService,
    updateProjectAvailability: UpdateProjectAvailabilityService,
    recordWorktreePresence: RecordWorktreePresenceService,
    readWorktreeStatuses: ReadWorktreeStatusesService,
    composeInventory: ComposeInventoryService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.listRegisteredProjects = listRegisteredProjects;
    this.listProjectWorktrees = listProjectWorktrees;
    this.updateProjectAvailability = updateProjectAvailability;
    this.recordWorktreePresence = recordWorktreePresence;
    this.readWorktreeStatuses = readWorktreeStatuses;
    this.composeInventory = composeInventory;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(context: OperationContext): Promise<ReadInventoryResponse> {
    return this.lanes.run(
      this.laneKeys.inventory(),
      'read',
      async ({ signal }) => {
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
        const statuses = this.readWorktreeStatuses.execute({ listings });
        return this.composeInventory.execute({ listings, statuses });
      },
      { callerSignal: context.signal },
    );
  }
}
