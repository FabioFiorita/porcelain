import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type {
  MarkCommentsSeenRequest,
  MarkCommentsSeenResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { MarkCommentsSeenService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';

export class MarkCommentsSeenUseCase {
  private readonly access: WorktreeAccess;
  private readonly markCommentsSeen: MarkCommentsSeenService;
  private readonly events: EventPublisher;

  constructor(
    access: WorktreeAccess,
    markCommentsSeen: MarkCommentsSeenService,
    events: EventPublisher,
  ) {
    this.access = access;
    this.markCommentsSeen = markCommentsSeen;
    this.events = events;
  }

  execute(
    input: WorktreeParams & MarkCommentsSeenRequest,
  ): Effect.Effect<MarkCommentsSeenResponse, WorktreeAccessFailure> {
    return this.access
      .transaction(
        input.worktreeId,
        () => Effect.void,
        () => this.markCommentsSeen.execute(input),
        (value) =>
          Effect.sync(() => {
            if (value.changed)
              this.events.worktreeChanged({
                worktreeId: input.worktreeId,
                change: 'comments',
              });
          }),
      )
      .pipe(Effect.map((value) => (({ changed, ...seen }) => seen)(value)));
  }
}
