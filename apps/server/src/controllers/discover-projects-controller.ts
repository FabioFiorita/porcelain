import type { DiscoverProjectsResponse } from '@porcelain/contracts/projects';
import type { DiscoverProjectsService } from '@porcelain/projects/services';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class DiscoverProjectsController {
  private readonly discoverProjects: DiscoverProjectsService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    discoverProjects: DiscoverProjectsService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.discoverProjects = discoverProjects;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(context: OperationContext): Promise<DiscoverProjectsResponse> {
    return this.lanes.run(
      this.laneKeys.filesystem(),
      'read',
      ({ signal }) => this.discoverProjects.execute(signal),
      { callerSignal: context.signal },
    );
  }
}
