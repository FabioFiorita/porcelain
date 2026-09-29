import type { ReviewedFiles, ReviewedScope } from './reviewed-mark.ts';

export type ListReviewedFilesInput = {
  worktreeId: string;
  scope?: ReviewedScope | undefined;
  branch?: string | undefined;
};

export type ListReviewedFilesResult = ReviewedFiles;
