import type { Review } from './review.ts';

export type RecordReviewActivityInput = {
  review: Review;
  active: boolean;
};
