import type { ReviewTexts } from './review-evidence.ts';

export type ReadReviewTextsInput = {
  worktreeId: string;
  paths: readonly string[];
};

export type ReadReviewTextsResult = ReviewTexts;
