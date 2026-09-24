import type { InvalidateReviewedMarksInput } from '@porcelain/reviews/models';
import type { InvalidateReviewedMarksService } from '@porcelain/reviews/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';
import type { WorktreeCheck } from '../../runtime/worktree-check.ts';

export class InvalidateReviewedMarksUseCase {
  private readonly checkWorktree: WorktreeCheck;
  private readonly invalidateReviewedMarks: InvalidateReviewedMarksService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    checkWorktree: WorktreeCheck,
    invalidateReviewedMarks: InvalidateReviewedMarksService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.checkWorktree = checkWorktree;
    this.invalidateReviewedMarks = invalidateReviewedMarks;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  async execute(
    input: InvalidateReviewedMarksInput,
    context: OperationContext,
  ): Promise<void> {
    const worktree = await this.checkWorktree.execute(
      { worktreeId: input.worktreeId, requireAvailableProject: false },
      context,
    );
    return this.lanes.run(
      this.laneKeys.reviews(worktree),
      'write',
      async () => this.invalidateReviewedMarks.execute(input),
      { callerSignal: context.signal },
    );
  }
}
