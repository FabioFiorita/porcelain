import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import type {
  ComposeInventoryService,
  ListKnownWorktreesService,
  ListRegisteredProjectsService,
  ReadWorktreeStatusesService,
} from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ReadInventoryUseCase {
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly listKnownWorktrees: ListKnownWorktreesService;
  private readonly readWorktreeStatuses: ReadWorktreeStatusesService;
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly composeInventory: ComposeInventoryService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    listRegisteredProjects: ListRegisteredProjectsService,
    listKnownWorktrees: ListKnownWorktreesService,
    readWorktreeStatuses: ReadWorktreeStatusesService,
    readEnvironment: ReadEnvironmentService,
    composeInventory: ComposeInventoryService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.listRegisteredProjects = listRegisteredProjects;
    this.listKnownWorktrees = listKnownWorktrees;
    this.readWorktreeStatuses = readWorktreeStatuses;
    this.readEnvironment = readEnvironment;
    this.composeInventory = composeInventory;
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
        const statuses = this.readWorktreeStatuses.execute({ listings });
        const { environmentId } = this.readEnvironment.execute();
        return this.composeInventory.execute({
          environmentId,
          inventory,
          listings,
          statuses,
        });
      },
      { callerSignal: context.signal },
    );
  }
}
