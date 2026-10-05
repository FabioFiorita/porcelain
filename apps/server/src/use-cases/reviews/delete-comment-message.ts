import type {
  CommentTargetNotFoundError,
  CommentAuthorMismatchError,
} from '@porcelain/reviews/errors';
import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type {
  CommentAuthor,
  CommentThreadParams,
  DeleteCommentMessageQuery,
  DeleteCommentMessageResponse,
} from '@porcelain/contracts/reviews';
import type { DeleteCommentMessageService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';

export class DeleteCommentMessageUseCase {
  private readonly access: WorktreeAccess;
  private readonly deleteCommentMessage: DeleteCommentMessageService;
  private readonly events: EventPublisher;

  constructor(
    access: WorktreeAccess,
    deleteCommentMessage: DeleteCommentMessageService,
    events: EventPublisher,
  ) {
    this.access = access;
    this.deleteCommentMessage = deleteCommentMessage;
    this.events = events;
  }

  execute(
    input: CommentThreadParams & DeleteCommentMessageQuery & CommentAuthor,
  ): Effect.Effect<
    DeleteCommentMessageResponse,
    | WorktreeAccessFailure
    | CommentTargetNotFoundError
    | CommentAuthorMismatchError
  > {
    return this.access.transaction(
      input.worktreeId,
      () => Effect.void,
      () => this.deleteCommentMessage.execute(input),
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
