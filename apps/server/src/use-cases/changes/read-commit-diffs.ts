import type {
  CheckCommitService,
  ReadCommitDiffsService,
} from '@porcelain/changes/services';
import type {
  ReadCommitDiffsParams,
  ReadCommitDiffsRequest,
  ReadCommitDiffsResponse,
} from '@porcelain/contracts/changes';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ReadCommitDiffsUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly checkCommit: CheckCommitService;
  private readonly readCommitDiffs: ReadCommitDiffsService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: CheckWorktreeService,
    checkCommit: CheckCommitService,
    readCommitDiffs: ReadCommitDiffsService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.checkCommit = checkCommit;
    this.readCommitDiffs = readCommitDiffs;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: ReadCommitDiffsParams & ReadCommitDiffsRequest,
    context: OperationContext,
  ): Promise<ReadCommitDiffsResponse> {
    const { worktreeId, oid, parent, paths } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId },
      context.signal,
    );
    return this.lanes.run(
      this.laneKeys.repository(worktree),
      'read',
      async ({ signal }) => {
        await this.checkCommit.execute({ worktreeId, oid, parent }, signal);
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
