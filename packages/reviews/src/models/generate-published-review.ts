import type { ResolvedReview, SummaryLinkLimits } from './resolved-review.ts';
import type { ReviewEvidence } from './review-evidence.ts';
import type { Review } from './review.ts';

export type GeneratePublishedReviewInput = {
  environmentId: string;
  review: Review;
  evidence: ReviewEvidence;
};

export type GeneratePublishedReviewResult = ResolvedReview;

export type GeneratePublishedReviewOptions = SummaryLinkLimits;
