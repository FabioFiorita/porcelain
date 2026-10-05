import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { InvalidateReviewedMarksInput } from '@porcelain/reviews/models';
import type { InvalidateReviewedMarksService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';

export class InvalidateReviewedMarksUseCase {
  private readonly access: WorktreeAccess;
  private readonly invalidateReviewedMarks: InvalidateReviewedMarksService;
  private readonly events: EventPublisher;

  constructor(
    access: WorktreeAccess,
    invalidateReviewedMarks: InvalidateReviewedMarksService,
    events: EventPublisher,
  ) {
    this.access = access;
    this.invalidateReviewedMarks = invalidateReviewedMarks;
    this.events = events;
  }

  execute(
    input: InvalidateReviewedMarksInput,
  ): Effect.Effect<void, WorktreeAccessFailure> {
    return this.access
      .transaction(
        input.worktreeId,
        () => Effect.void,
        () => this.invalidateReviewedMarks.execute(input),
        (value) =>
          Effect.sync(() => {
            if (value.changed)
              this.events.worktreeChanged({
                worktreeId: input.worktreeId,
                change: 'reviewed',
              });
          }),
      )
      .pipe(Effect.asVoid);
  }
}
