import type {
  RecordReviewActivityInput,
  RecordReviewActivityResult,
} from '../models/review-operations.ts';
import type { ReviewStore } from '../ports/review-store.ts';

export class RecordReviewActivityService {
  private readonly reviewStore: ReviewStore;

  constructor(reviewStore: ReviewStore) {
    this.reviewStore = reviewStore;
  }

  execute(input: RecordReviewActivityInput): RecordReviewActivityResult {
    if (input.active === input.review.active) return;
    this.reviewStore.setActive(
      input.review.worktreeId,
      input.review.revision,
      input.active,
    );
  }
}
