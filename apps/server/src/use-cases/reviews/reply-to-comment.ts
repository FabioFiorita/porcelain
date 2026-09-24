import type { ReplyToCommentResponse } from '@porcelain/contracts/reviews';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import type { ReplyToCommentInput } from '@porcelain/reviews/models';
import type { ReplyToCommentService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export class ReplyToCommentUseCase {
  private readonly checkWorktree: CheckWorktreeService;
  private readonly replyToComment: ReplyToCommentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: CheckWorktreeService,
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
      { worktreeId, purpose: 'writing' },
      context.signal,
    );
    const thread = await this.lanes.run(
      this.laneKeys.repository(worktree),
      'write',
      async () => this.replyToComment.execute(input),
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged(worktreeId, 'comments');
    return thread;
  }
}
