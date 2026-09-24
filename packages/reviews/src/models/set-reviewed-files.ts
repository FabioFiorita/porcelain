import type { FileChange } from '@porcelain/kernel/models';
import type {
  ReviewedFile,
  ReviewedFileConflict,
  ReviewedFiles,
} from './reviewed-mark.ts';

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
