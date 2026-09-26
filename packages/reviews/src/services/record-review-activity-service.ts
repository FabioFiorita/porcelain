import type {
  RecordReviewActivityInput,
  RecordReviewActivityResult,
} from '../models/record-review-activity.ts';
import type { ReviewStore } from '../ports/review-store.ts';
import { reviewActivity } from '../rules/review-activity.ts';

export class RecordReviewActivityService {
  private readonly reviews: ReviewStore;

  constructor(reviews: ReviewStore) {
    this.reviews = reviews;
  }

  execute(input: RecordReviewActivityInput): RecordReviewActivityResult {
    const { review } = input;
    const active = reviewActivity(review, input.evidence);
    if (active === review.active) return { changed: false };
    this.reviews.setActive({
      worktreeId: review.worktreeId,
      revision: review.revision,
      active,
    });
    return { changed: true };
  }
}
