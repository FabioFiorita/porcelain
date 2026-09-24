import type { InvalidateReviewedMarksInput } from '@porcelain/reviews/models';
import type { InvalidateReviewedMarksService } from '@porcelain/reviews/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class InvalidateReviewedMarksUseCase {
  private readonly invalidateReviewedMarks: InvalidateReviewedMarksService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    invalidateReviewedMarks: InvalidateReviewedMarksService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.invalidateReviewedMarks = invalidateReviewedMarks;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(
    input: InvalidateReviewedMarksInput,
    context: OperationContext,
  ): Promise<void> {
    return this.lanes.run(
      this.laneKeys.worktree(input.worktreeId),
      'write',
      async () => this.invalidateReviewedMarks.execute(input),
      { callerSignal: context.signal },
    );
  }
}
