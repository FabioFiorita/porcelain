import type { InvalidLineRangeError } from '@porcelain/kernel/errors';
import type {
  CommentIdentityConflictError,
  CommentLimitExceededError,
  CommentRevisionMismatchError,
  UnsupportedCommentComparisonError,
} from '@porcelain/reviews/errors';
import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type {
  CommentAuthor,
  CreateCommentThreadRequest,
  CreateCommentThreadResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { CreateCommentThreadService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';

export class CreateCommentThreadUseCase {
  private readonly access: WorktreeAccess;
  private readonly createCommentThread: CreateCommentThreadService;
  private readonly events: EventPublisher;

  constructor(
    access: WorktreeAccess,
    createCommentThread: CreateCommentThreadService,
    events: EventPublisher,
  ) {
    this.access = access;
    this.createCommentThread = createCommentThread;
    this.events = events;
  }

  execute(
    input: WorktreeParams & CreateCommentThreadRequest & CommentAuthor,
  ): Effect.Effect<
    CreateCommentThreadResponse,
    | WorktreeAccessFailure
    | CommentIdentityConflictError
    | CommentLimitExceededError
    | InvalidLineRangeError
    | CommentRevisionMismatchError
    | UnsupportedCommentComparisonError
  > {
    return this.access.transaction(
      input.worktreeId,
      () => Effect.void,
      () => this.createCommentThread.execute(input),
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
