import type { ReviewTexts } from './review-evidence.ts';
import type { ReviewedLayers } from './reviewed-mark.ts';

export type ListReviewedLayersInput = {
  worktreeId: string;
  texts: ReviewTexts;
};

export type ListReviewedLayersResult = ReviewedLayers;
