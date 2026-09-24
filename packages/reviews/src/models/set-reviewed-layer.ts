import type { ReviewTextRead } from './review-evidence.ts';
import type { ReviewLayer } from './review.ts';
import type { ReviewedLayers } from './reviewed-mark.ts';

export type SetReviewedLayerInput = {
  worktreeId: string;
  layer: ReviewLayer;
  fingerprint: string;
  texts: readonly ReviewTextRead[];
};

export type SetReviewedLayerResult = ReviewedLayers;
