import type { ReviewedFiles } from './reviewed-mark.ts';

export type RemoveReviewedFileInput = {
  worktreeId: string;
  path: string;
};

export type RemoveReviewedFileResult = ReviewedFiles & { removed: boolean };
