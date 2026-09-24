import type { ReviewTextRead } from './review-evidence.ts';

export type ReconcileReviewedLayersInput = {
  worktreeId: string;
  texts: readonly ReviewTextRead[];
};
