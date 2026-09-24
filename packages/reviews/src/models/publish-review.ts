import type { ReviewTextRead } from './review-evidence.ts';
import type { Review, ReviewDraft } from './review.ts';

export type ReviewPublication = {
  worktreeId: string;
  review: ReviewDraft;
};

export type PublishReviewInput = {
  worktreeId: string;
  draft: ReviewDraft;
  texts: readonly ReviewTextRead[];
};

export type PublishReviewResult = {
  review: Review;
  warnings: string[];
};
