import type { ReviewedFiles } from './reviewed-mark.ts';

export type ListReviewedFilesInput = {
  worktreeId: string;
};

export type ListReviewedFilesResult = ReviewedFiles;
