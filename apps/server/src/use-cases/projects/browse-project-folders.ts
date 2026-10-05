import type { Effect } from 'effect';
import type {
  FolderNotFoundError,
  FolderNotReadableError,
  UnsupportedFolderNameError,
} from '@porcelain/projects/errors';
import type {
  BrowseProjectFoldersQuery,
  BrowseProjectFoldersResponse,
} from '@porcelain/contracts/projects';
import type { BrowseProjectFoldersService } from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

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
  ): Effect.Effect<
    BrowseProjectFoldersResponse,
    FolderNotFoundError | FolderNotReadableError | UnsupportedFolderNameError
  > {
    return this.lanes.run(this.laneKeys.filesystem(), 'read', () =>
      this.browseProjectFolders.execute(input),
    );
  }
}
