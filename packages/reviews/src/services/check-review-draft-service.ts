import { Effect } from 'effect';
import { ReviewConflictError } from '../errors/review-conflict-error.ts';
import type { CheckReviewDraftInput } from '../models/check-review-draft.ts';
import type { ReviewStore } from '../ports/review-store.ts';

export class CheckReviewDraftService {
  private readonly reviews: ReviewStore;

  constructor(reviews: ReviewStore) {
    this.reviews = reviews;
  }

  execute(
    input: CheckReviewDraftInput,
  ): Effect.Effect<void, ReviewConflictError> {
    return Effect.gen({ self: this }, function* () {
      const current = this.reviews.read({ worktreeId: input.worktreeId });
      if ((current?.revision ?? 0) !== input.draft.expectedRevision)
        return yield* Effect.fail(new ReviewConflictError());
    });
  }
}
