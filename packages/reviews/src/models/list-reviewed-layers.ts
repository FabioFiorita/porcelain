import type { ReviewedLayers } from './reviewed-mark.ts';

export type ListReviewedLayersInput = {
  worktreeId: string;
};

export type ListReviewedLayersResult = ReviewedLayers;
