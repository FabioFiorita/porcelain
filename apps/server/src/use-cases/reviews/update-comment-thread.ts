import type { CommentTargetNotFoundError } from '@porcelain/reviews/errors';
import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type {
  CommentThreadParams,
  UpdateCommentThreadRequest,
  UpdateCommentThreadResponse,
} from '@porcelain/contracts/reviews';
import type { UpdateCommentThreadService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';

export class UpdateCommentThreadUseCase {
  private readonly access: WorktreeAccess;
  private readonly updateCommentThread: UpdateCommentThreadService;
  private readonly events: EventPublisher;

  constructor(
    access: WorktreeAccess,
    updateCommentThread: UpdateCommentThreadService,
    events: EventPublisher,
  ) {
    this.access = access;
    this.updateCommentThread = updateCommentThread;
    this.events = events;
  }

  execute(
    input: CommentThreadParams & UpdateCommentThreadRequest,
  ): Effect.Effect<
    UpdateCommentThreadResponse,
    WorktreeAccessFailure | CommentTargetNotFoundError
  > {
    return this.access
      .transaction(
        input.worktreeId,
        () => Effect.void,
        () => this.updateCommentThread.execute(input),
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
