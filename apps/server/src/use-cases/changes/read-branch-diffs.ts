import type { ReadBranchDiffsService } from '@porcelain/changes/services';
import type {
  ReadBranchDiffsRequest,
  ReadBranchDiffsResponse,
} from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class ReadBranchDiffsUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly readBranchDiffs: ReadBranchDiffsService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    readBranchDiffs: ReadBranchDiffsService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.readBranchDiffs = readBranchDiffs;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: WorktreeParams & ReadBranchDiffsRequest,
    context: OperationContext,
  ): Promise<ReadBranchDiffsResponse> {
    const { worktreeId, baseOid, headOid, paths } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    return this.lanes.runConsistent(
      this.laneKeys.repository(worktree),
      worktree,
      async ({ signal }) => {
        const diffs = await this.readBranchDiffs.execute(
          { worktreeId, baseOid, headOid, paths },
          signal,
        );
        return diffs;
      },
      { callerSignal: context.signal },
    );
  }
}
