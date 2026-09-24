import type { FileChange } from '@porcelain/kernel/models';
import type { ResolvedReview } from './resolved-review.ts';
import type { ReviewDiff, ReviewTextRead } from './review-evidence.ts';
import type { Review } from './review.ts';

export type GeneratePublishedReviewInput = {
  environmentId: string;
  review: Review;
  changes: readonly FileChange[];
  texts: readonly ReviewTextRead[];
  diffs: readonly ReviewDiff[];
};

export type GeneratePublishedReviewResult = ResolvedReview;
