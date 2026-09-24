import type {
  ReadPreviewAssetsRequest,
  ReadPreviewAssetsResponse,
} from '@porcelain/contracts/files';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ReadPreviewAssetsService } from '@porcelain/files/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';
import type { WorktreeCheck } from '../../runtime/worktree-check.ts';

export class ReadPreviewAssetsUseCase {
  private readonly checkWorktree: WorktreeCheck;
  private readonly readPreviewAssets: ReadPreviewAssetsService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: WorktreeCheck,
    readPreviewAssets: ReadPreviewAssetsService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.readPreviewAssets = readPreviewAssets;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: WorktreeParams & ReadPreviewAssetsRequest,
    context: OperationContext,
  ): Promise<ReadPreviewAssetsResponse> {
    const worktree = await this.checkWorktree.execute(
      { worktreeId: input.worktreeId, requireAvailableProject: false },
      context,
    );
    return this.lanes.runConsistent(
      this.laneKeys.repository(worktree),
      worktree,
      async ({ signal }) => {
        const result = await this.readPreviewAssets.execute(input, signal);
        return result;
      },
      { callerSignal: context.signal },
    );
  }
}
