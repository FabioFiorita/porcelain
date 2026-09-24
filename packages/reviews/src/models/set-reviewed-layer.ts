import type { ReviewTexts } from './review-evidence.ts';
import type { ReviewLayer } from './review.ts';
import type { ReviewedLayers } from './reviewed-mark.ts';

export type SetReviewedLayerInput = {
  worktreeId: string;
  layer: ReviewLayer;
  fingerprint: string;
  texts: ReviewTexts;
};

export type SetReviewedLayerResult = ReviewedLayers;
