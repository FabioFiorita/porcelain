import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type {
  CommentAuthor,
  DeleteResolvedCommentsRequest,
  DeleteResolvedCommentsResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { DeleteResolvedCommentsService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';

export class DeleteResolvedCommentsUseCase {
  private readonly access: WorktreeAccess;
  private readonly deleteResolvedComments: DeleteResolvedCommentsService;
  private readonly events: EventPublisher;

  constructor(
    access: WorktreeAccess,
    deleteResolvedComments: DeleteResolvedCommentsService,
    events: EventPublisher,
  ) {
    this.access = access;
    this.deleteResolvedComments = deleteResolvedComments;
    this.events = events;
  }

  execute(
    input: WorktreeParams & DeleteResolvedCommentsRequest & CommentAuthor,
  ): Effect.Effect<DeleteResolvedCommentsResponse, WorktreeAccessFailure> {
    return this.access.transaction(
      input.worktreeId,
      () => Effect.void,
      () => this.deleteResolvedComments.execute(input),
      (value) =>
        Effect.sync(() => {
          if (value.deleted.length > 0)
            this.events.worktreeChanged({
              worktreeId: input.worktreeId,
              change: 'comments',
            });
        }),
    );
  }
}
