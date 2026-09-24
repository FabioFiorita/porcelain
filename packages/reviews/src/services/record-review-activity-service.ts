import type { RecordReviewActivityInput } from '../models/record-review-activity.ts';
import type { ReviewStore } from '../ports/review-store.ts';

export class RecordReviewActivityService {
  private readonly reviews: ReviewStore;

  constructor(reviews: ReviewStore) {
    this.reviews = reviews;
  }

  execute(input: RecordReviewActivityInput): void {
    const { review, active } = input;
    if (active === review.active) return;
    this.reviews.setActive({
      worktreeId: review.worktreeId,
      revision: review.revision,
      active,
    });
  }
}
