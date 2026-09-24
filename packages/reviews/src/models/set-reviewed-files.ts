import type {
  ReviewedFile,
  ReviewedFileConflict,
  ReviewedFileLimits,
  ReviewedFiles,
} from './reviewed-mark.ts';
import type { FileChange } from '@porcelain/kernel/models';

export type SetReviewedFilesInput = {
  worktreeId: string;
  files: readonly ReviewedFile[];
  changes: readonly FileChange[];
  onConflict: 'report' | 'refuse';
};

export type SetReviewedFilesResult = ReviewedFiles & {
  marked: string[];
  conflicts: ReviewedFileConflict[];
};

export type SetReviewedFilesOptions = ReviewedFileLimits;
