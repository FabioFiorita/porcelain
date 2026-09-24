import type { ReplyToCommentResponse } from '@porcelain/contracts/reviews';
import type { ReplyToCommentInput } from '@porcelain/reviews/models';
import type { ReplyToCommentService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';
import type { WorktreeCheck } from '../../runtime/worktree-check.ts';

export class ReplyToCommentUseCase {
  private readonly checkWorktree: WorktreeCheck;
  private readonly replyToComment: ReplyToCommentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: WorktreeCheck,
    replyToComment: ReplyToCommentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktree = checkWorktree;
    this.replyToComment = replyToComment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: ReplyToCommentInput,
    context: OperationContext,
  ): Promise<ReplyToCommentResponse> {
    const { worktreeId } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    const thread = await this.lanes.run(
      this.laneKeys.reviews(worktree),
      'write',
      async () => this.replyToComment.execute(input),
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged({ worktreeId, change: 'comments' });
    return thread;
  }
}
