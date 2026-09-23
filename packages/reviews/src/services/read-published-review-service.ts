import type {
  ReadPublishedReviewInput,
  ReadPublishedReviewResult,
} from '../models/review-operations.ts';
import type { ReviewStore } from '../ports/review-store.ts';

export class ReadPublishedReviewService {
  private readonly reviewStore: ReviewStore;

  constructor(reviewStore: ReviewStore) {
    this.reviewStore = reviewStore;
  }

  execute(input: ReadPublishedReviewInput): ReadPublishedReviewResult {
    return this.reviewStore.read(input.worktreeId);
  }
}
