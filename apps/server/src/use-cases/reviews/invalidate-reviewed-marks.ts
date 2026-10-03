import type { InvalidateReviewedMarksInput } from '@porcelain/reviews/models';
import type { InvalidateReviewedMarksService } from '@porcelain/reviews/services';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class InvalidateReviewedMarksUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly invalidateReviewedMarks: InvalidateReviewedMarksService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    invalidateReviewedMarks: InvalidateReviewedMarksService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktree = checkWorktree;
    this.invalidateReviewedMarks = invalidateReviewedMarks;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: InvalidateReviewedMarksInput,
    context: OperationContext,
  ): Promise<void> {
    const { worktreeId } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    const { changed } = await this.lanes.run(
      this.laneKeys.reviews(worktree),
      'write',
      async () => this.invalidateReviewedMarks.execute(input),
      { callerSignal: context.signal },
    );
    if (changed)
      this.events.worktreeChanged({ worktreeId, change: 'reviewed' });
  }
}
