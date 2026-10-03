import type { ReviewEvidence } from './review-evidence.ts';
import type { Review } from './review.ts';

export type RecordReviewActivityResult = { changed: boolean };

export type RecordReviewActivityInput = {
  review: Review;
  evidence: ReviewEvidence;
};
