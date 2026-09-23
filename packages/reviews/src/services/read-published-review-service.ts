import type { StoredReview } from '../models/stored-review.ts';
import type { ReviewStore } from '../ports/review-store.ts';

export class ReadPublishedReviewService {
  private readonly store: ReviewStore;

  constructor(store: ReviewStore) {
    this.store = store;
  }

  execute(worktreeId: string): StoredReview | undefined {
    return this.store.read(worktreeId);
  }
}
