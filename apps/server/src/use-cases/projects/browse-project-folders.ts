import type {
  BrowseProjectFoldersQuery,
  BrowseProjectFoldersResponse,
} from '@porcelain/contracts/projects';
import type { BrowseProjectFoldersService } from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class BrowseProjectFoldersUseCase {
  private readonly browseProjectFolders: BrowseProjectFoldersService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    browseProjectFolders: BrowseProjectFoldersService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.browseProjectFolders = browseProjectFolders;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: BrowseProjectFoldersQuery,
    context: OperationContext,
  ): Promise<BrowseProjectFoldersResponse> {
    return this.lanes.run(
      this.laneKeys.filesystem(),
      'read',
      ({ signal }) => this.browseProjectFolders.execute(input, signal),
      { callerSignal: context.signal },
    );
  }
}
