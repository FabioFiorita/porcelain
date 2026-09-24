import type { FileChange } from '@porcelain/kernel/models';
import type { ReviewDiff, ReviewTextRead } from './review-evidence.ts';
import type { Review } from './review.ts';

export type RefreshReviewActivityInput = {
  review: Review;
  changes: readonly FileChange[];
  texts: readonly ReviewTextRead[];
  diffs: readonly ReviewDiff[];
};
