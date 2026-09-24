import type { ReviewEvidence } from '../models/review-evidence.ts';
import type { Review } from '../models/review.ts';
import { resolveReview, reviewIsActive } from './resolve-review.ts';

export function reviewActivity(
  review: Pick<Review, 'layers'>,
  evidence: ReviewEvidence,
): boolean {
  return reviewIsActive(resolveReview(review, evidence).layers);
}
