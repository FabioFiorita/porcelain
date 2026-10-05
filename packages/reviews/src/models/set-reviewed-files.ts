import type {
  ReviewedFile,
  ReviewedFileConflict,
  ReviewedFileLimits,
  ReviewedFiles,
  ReviewedScope,
} from './reviewed-mark.ts';
import type { ExpectedFile } from '@porcelain/kernel/models';

export type SetReviewedFilesInput = {
  worktreeId: string;
  scope?: ReviewedScope | undefined;
  branch?: string | undefined;
  files: readonly ReviewedFile[];
  changes: readonly ExpectedFile[];
  onConflict: 'report' | 'refuse';
};

export type SetReviewedFilesResult = ReviewedFiles & {
  marked: readonly string[];
  conflicts: readonly ReviewedFileConflict[];
  changed: boolean;
};

export type SetReviewedFilesOptions = ReviewedFileLimits;
