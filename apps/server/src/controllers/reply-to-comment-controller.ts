import type {
  CommentThreadParams,
  ReplyToCommentRequest,
  ReplyToCommentResponse,
} from '@porcelain/contracts/reviews';
import type { CommentWriter } from '@porcelain/reviews/models';
import type {
  CheckWorktreeAccessService,
  ReplyToCommentService,
} from '@porcelain/reviews/services';
import type { EventPublisher } from '../runtime/event-publisher.ts';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export class ReplyToCommentController {
  private readonly checkWorktreeAccess: CheckWorktreeAccessService;
  private readonly replyToComment: ReplyToCommentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly events: EventPublisher;

  constructor(
    checkWorktreeAccess: CheckWorktreeAccessService,
    replyToComment: ReplyToCommentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    events: EventPublisher,
  ) {
    this.checkWorktreeAccess = checkWorktreeAccess;
    this.replyToComment = replyToComment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.events = events;
  }

  async execute(
    input: CommentThreadParams &
      ReplyToCommentRequest & { writer: CommentWriter },
    context: OperationContext,
  ): Promise<ReplyToCommentResponse> {
    const { worktreeId } = input;
    const thread = await this.lanes.run(
      this.laneKeys.worktree(worktreeId),
      'write',
      async ({ signal }) => {
        await this.checkWorktreeAccess.execute(
          { worktreeId, intent: 'write' },
          signal,
        );
        return this.replyToComment.execute(input);
      },
      { callerSignal: context.signal },
    );
    this.events.worktreeChanged(worktreeId, 'comments');
    return [thread];
  }
}
