import type {
  ConfirmCommitService,
  CheckWorktreeService,
  ReadCommitDiffsService,
} from '@porcelain/changes/services';
import type {
  ReadCommitDiffsParams,
  ReadCommitDiffsRequest,
  ReadCommitDiffsResponse,
} from '@porcelain/contracts/changes';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ReadCommitDiffsUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly confirmCommit: ConfirmCommitService;
  private readonly readCommitDiffs: ReadCommitDiffsService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    confirmCommit: ConfirmCommitService,
    readCommitDiffs: ReadCommitDiffsService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.confirmCommit = confirmCommit;
    this.readCommitDiffs = readCommitDiffs;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: ReadCommitDiffsParams & ReadCommitDiffsRequest,
    context: OperationContext,
  ): Promise<ReadCommitDiffsResponse> {
    const { worktreeId, oid, parent, paths } = input;
    return this.lanes.run(
      this.laneKeys.worktree(worktreeId),
      'read',
      async ({ signal }) => {
        await this.checkWorktree.execute({ worktreeId }, signal);
        await this.confirmCommit.execute({ worktreeId, oid, parent }, signal);
        const diffs = await this.readCommitDiffs.execute(
          { worktreeId, oid, parent, paths },
          signal,
        );
        await this.checkWorktree.execute({ worktreeId }, signal);
        return diffs;
      },
      { callerSignal: context.signal },
    );
  }
}
