import type { ResolvedReview, SummaryLinkLimits } from './resolved-review.ts';
import type { Review } from './review.ts';

export type ResolvePublishedReviewInput = {
  environmentId: string;
  review: Review;
  headOid: string | undefined;
  dirtyPaths?: readonly string[] | undefined;
};

export type ResolvePublishedReviewResult = ResolvedReview;

export type ResolvePublishedReviewOptions = SummaryLinkLimits;
