import type {
  CommentAuthor,
  CommentThreadParams,
  ReplyToCommentRequest,
  ReplyToCommentResponse,
} from '@porcelain/contracts/reviews';
import type { ReplyToCommentService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

export class ReplyToCommentUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly replyToComment: ReplyToCommentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
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
    input: CommentThreadParams & ReplyToCommentRequest & CommentAuthor,
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
