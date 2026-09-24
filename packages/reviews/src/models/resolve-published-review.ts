import type { ResolvedReview, SummaryLinkLimits } from './resolved-review.ts';
import type { ReviewEvidence } from './review-evidence.ts';
import type { Review } from './review.ts';

export type ResolvePublishedReviewInput = {
  environmentId: string;
  review: Review;
  evidence: ReviewEvidence;
};

export type ResolvePublishedReviewResult = ResolvedReview;

export type ResolvePublishedReviewOptions = SummaryLinkLimits;
