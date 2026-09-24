import type { ReviewLayer } from './review.ts';

export type ReadReviewLayerInput = {
  worktreeId: string;
  layerId: string;
};

export type ReadReviewLayerResult = {
  layer: ReviewLayer;
  paths: string[];
};
