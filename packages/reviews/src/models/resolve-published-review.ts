import type { ResolvedReview, SummaryLinkLimits } from './resolved-review.ts';
import type { Review } from './review.ts';
import type { ReviewTexts } from './review-evidence.ts';

export type ResolvePublishedReviewInput = {
  environmentId: string;
  review: Review;
  headOid: string | undefined;
  dirtyPaths?: readonly string[] | undefined;
  worktree?: { texts: ReviewTexts; missing: ReadonlySet<string> } | undefined;
};

export type ResolvePublishedReviewResult = ResolvedReview;

export type ResolvePublishedReviewOptions = SummaryLinkLimits;
