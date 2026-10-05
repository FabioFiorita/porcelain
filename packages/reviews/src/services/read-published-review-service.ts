import { Effect } from 'effect';
import type {
  ReadPublishedReviewInput,
  ReadPublishedReviewResult,
} from '../models/read-published-review.ts';
import type { ReviewStore } from '../ports/review-store.ts';

export class ReadPublishedReviewService {
  private readonly reviews: ReviewStore;

  constructor(reviews: ReviewStore) {
    this.reviews = reviews;
  }

  execute(
    input: ReadPublishedReviewInput,
  ): Effect.Effect<ReadPublishedReviewResult, never> {
    return Effect.sync(() => {
      const review = this.reviews.read({ worktreeId: input.worktreeId });
      return review ? { kind: 'published', review } : { kind: 'none' };
    });
  }
}
