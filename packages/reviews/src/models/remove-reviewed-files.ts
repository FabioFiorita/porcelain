import type { ReviewedFiles, ReviewedScope } from './reviewed-mark.ts';

export type RemoveReviewedFilesInput = {
  worktreeId: string;
  scope?: ReviewedScope | undefined;
  paths: readonly string[];
};

export type RemoveReviewedFilesResult = ReviewedFiles & { removed: boolean };
