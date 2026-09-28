import type { ReviewedFiles } from './reviewed-mark.ts';

export type RemoveReviewedFilesInput = {
  worktreeId: string;
  paths: readonly string[];
};

export type RemoveReviewedFilesResult = ReviewedFiles & { removed: boolean };
