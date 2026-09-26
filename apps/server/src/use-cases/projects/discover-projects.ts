import type { DiscoverProjectsResponse } from '@porcelain/contracts/projects';
import type {
  DiscoverProjectsService,
  ListRegisteredProjectsService,
} from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';

export class DiscoverProjectsUseCase {
  private readonly discoverProjects: DiscoverProjectsService;
  private readonly listRegisteredProjects: ListRegisteredProjectsService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    discoverProjects: DiscoverProjectsService,
    listRegisteredProjects: ListRegisteredProjectsService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.discoverProjects = discoverProjects;
    this.listRegisteredProjects = listRegisteredProjects;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(context: OperationContext): Promise<DiscoverProjectsResponse> {
    const inventory = await this.lanes.run(
      this.laneKeys.inventory(),
      'read',
      async () => this.listRegisteredProjects.execute(),
      { callerSignal: context.signal },
    );
    return this.lanes.run(
      this.laneKeys.filesystem(),
      'read',
      ({ signal }) => this.discoverProjects.execute(inventory, signal),
      { callerSignal: context.signal },
    );
  }
}
