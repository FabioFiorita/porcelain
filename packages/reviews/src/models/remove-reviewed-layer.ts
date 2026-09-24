import type { ReviewedLayers } from './reviewed-mark.ts';

export type RemoveReviewedLayerInput = {
  worktreeId: string;
  layerId: string;
};

export type RemoveReviewedLayerResult = ReviewedLayers & { removed: boolean };
