import type { ReviewTexts } from './review-evidence.ts';

export type ReconcileReviewedLayersInput = {
  worktreeId: string;
  texts: ReviewTexts;
};
