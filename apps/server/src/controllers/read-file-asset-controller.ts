import type {
  ReadFileAssetQuery,
  ReadFileAssetResponse,
} from '@porcelain/contracts/files';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  CheckWorktreeService,
  ReadFileAssetService,
} from '@porcelain/files/services';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class ReadFileAssetController {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly readFileAsset: ReadFileAssetService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    readFileAsset: ReadFileAssetService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.readFileAsset = readFileAsset;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: WorktreeParams & ReadFileAssetQuery,
    context: OperationContext,
  ): Promise<ReadFileAssetResponse> {
    const check = { worktreeId: input.worktreeId, purpose: 'reading' } as const;
    return this.lanes.run(
      this.laneKeys.worktree(input.worktreeId),
      'read',
      async ({ signal }) => {
        await this.checkWorktree.execute(check, signal);
        const result = await this.readFileAsset.execute(input, signal);
        await this.checkWorktree.execute(check, signal);
        return result;
      },
      { callerSignal: context.signal },
    );
  }
}
