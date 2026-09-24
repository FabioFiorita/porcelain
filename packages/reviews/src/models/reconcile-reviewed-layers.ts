import type { ReviewTexts } from './review-evidence.ts';

export type ReconcileReviewedLayersResult = { changed: boolean };

export type ReconcileReviewedLayersInput = {
  worktreeId: string;
  texts: ReviewTexts;
};
