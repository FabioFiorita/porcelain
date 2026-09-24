import type {
  MarkCommentsSeenRequest,
  MarkCommentsSeenResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type { MarkCommentsSeenService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class MarkCommentsSeenUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly markCommentsSeen: MarkCommentsSeenService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: CheckWorktreeService,
    markCommentsSeen: MarkCommentsSeenService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktree = checkWorktree;
    this.markCommentsSeen = markCommentsSeen;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: WorktreeParams & MarkCommentsSeenRequest,
    context: OperationContext,
  ): Promise<MarkCommentsSeenResponse> {
    const { worktreeId } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, purpose: 'writing' },
      context.signal,
    );
    const result = await this.lanes.run(
      this.laneKeys.reviews(worktree),
      'write',
      async () => this.markCommentsSeen.execute(input),
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged({ worktreeId, change: 'comments' });
    return result;
  }
}
