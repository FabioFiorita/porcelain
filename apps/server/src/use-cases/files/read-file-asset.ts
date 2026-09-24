import type {
  ReadFileAssetQuery,
  ReadFileAssetResponse,
} from '@porcelain/contracts/files';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ReadFileAssetService } from '@porcelain/files/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';
import type { WorktreeCheck } from '../../runtime/worktree-check.ts';

export class ReadFileAssetUseCase {
  private readonly checkWorktree: WorktreeCheck;
  private readonly readFileAsset: ReadFileAssetService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: WorktreeCheck,
    readFileAsset: ReadFileAssetService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.readFileAsset = readFileAsset;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: WorktreeParams & ReadFileAssetQuery,
    context: OperationContext,
  ): Promise<ReadFileAssetResponse> {
    const worktree = await this.checkWorktree.execute(
      { worktreeId: input.worktreeId, requireAvailableProject: false },
      context,
    );
    return this.lanes.runConsistent(
      this.laneKeys.repository(worktree),
      worktree,
      async ({ signal }) => {
        const result = await this.readFileAsset.execute(input, signal);
        return result;
      },
      { callerSignal: context.signal },
    );
  }
}
