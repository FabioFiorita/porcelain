import type {
  CommentIdentityConflictError,
  CommentTargetNotFoundError,
  CommentLimitExceededError,
} from '@porcelain/reviews/errors';
import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type {
  CommentAuthor,
  CommentThreadParams,
  ReplyToCommentRequest,
  ReplyToCommentResponse,
} from '@porcelain/contracts/reviews';
import type { ReplyToCommentService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';

export class ReplyToCommentUseCase {
  private readonly access: WorktreeAccess;
  private readonly replyToComment: ReplyToCommentService;
  private readonly events: EventPublisher;

  constructor(
    access: WorktreeAccess,
    replyToComment: ReplyToCommentService,
    events: EventPublisher,
  ) {
    this.access = access;
    this.replyToComment = replyToComment;
    this.events = events;
  }

  execute(
    input: CommentThreadParams & ReplyToCommentRequest & CommentAuthor,
  ): Effect.Effect<
    ReplyToCommentResponse,
    | WorktreeAccessFailure
    | CommentIdentityConflictError
    | CommentTargetNotFoundError
    | CommentLimitExceededError
  > {
    return this.access.transaction(
      input.worktreeId,
      () => Effect.void,
      () => this.replyToComment.execute(input),
      () =>
        Effect.sync(() => {
          this.events.worktreeChanged({
            worktreeId: input.worktreeId,
            change: 'comments',
          });
        }),
    );
  }
}
