import type {
  CommentTargetNotFoundError,
  CommentAuthorMismatchError,
  CommentLimitExceededError,
} from '@porcelain/reviews/errors';
import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type {
  CommentAuthor,
  CommentThreadParams,
  EditCommentMessageRequest,
  EditCommentMessageResponse,
} from '@porcelain/contracts/reviews';
import type { EditCommentMessageService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';

export class EditCommentMessageUseCase {
  private readonly access: WorktreeAccess;
  private readonly editCommentMessage: EditCommentMessageService;
  private readonly events: EventPublisher;

  constructor(
    access: WorktreeAccess,
    editCommentMessage: EditCommentMessageService,
    events: EventPublisher,
  ) {
    this.access = access;
    this.editCommentMessage = editCommentMessage;
    this.events = events;
  }

  execute(
    input: CommentThreadParams & EditCommentMessageRequest & CommentAuthor,
  ): Effect.Effect<
    EditCommentMessageResponse,
    | WorktreeAccessFailure
    | CommentTargetNotFoundError
    | CommentAuthorMismatchError
    | CommentLimitExceededError
  > {
    return this.access
      .transaction(
        input.worktreeId,
        () => Effect.void,
        () => this.editCommentMessage.execute(input),
        (value) =>
          Effect.sync(() => {
            if (value.changed)
              this.events.worktreeChanged({
                worktreeId: input.worktreeId,
                change: 'comments',
              });
          }),
      )
      .pipe(Effect.map((value) => value.thread));
  }
}
