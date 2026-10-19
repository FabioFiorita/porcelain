import type { ReviewLayer } from './review.ts';
import type { ReviewedLayerMark } from './reviewed-mark.ts';

export type SetReviewedLayerInput = {
  reviewId: string;
  layer: ReviewLayer;
  fingerprint: string;
};

export type SetReviewedLayerResult = ReviewedLayerMark;
