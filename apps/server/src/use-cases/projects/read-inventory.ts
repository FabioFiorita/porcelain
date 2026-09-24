import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import type {
  ListKnownWorktreesService,
  ListRegisteredProjectsService,
} from '@porcelain/projects/services';
import type { ReadWorktreeStatusesService } from '@porcelain/reviews/services';
import { inventoryReport } from '@porcelain/projects/rules';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ReadInventoryUseCase {
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly listKnownWorktrees: ListKnownWorktreesService;
  private readonly readWorktreeStatuses: ReadWorktreeStatusesService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    listRegisteredProjects: ListRegisteredProjectsService,
    listKnownWorktrees: ListKnownWorktreesService,
    readWorktreeStatuses: ReadWorktreeStatusesService,
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.listRegisteredProjects = listRegisteredProjects;
    this.listKnownWorktrees = listKnownWorktrees;
    this.readWorktreeStatuses = readWorktreeStatuses;
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(context: OperationContext): Promise<ReadInventoryResponse> {
    return this.lanes.run(
      this.laneKeys.inventory(),
      'read',
      async () => {
        const inventory = this.listRegisteredProjects.execute();
        const { listings } = this.listKnownWorktrees.execute(inventory);
        const { statuses } = this.readWorktreeStatuses.execute({
          worktreeIds: listings.flatMap((listing) =>
            listing.worktrees.map((worktree) => worktree.id),
          ),
        });
        const { environmentId } = this.readEnvironment.execute();
        return inventoryReport(environmentId, inventory, listings, statuses);
      },
      { callerSignal: context.signal },
    );
  }
}
