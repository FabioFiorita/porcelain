export type ReviewedScope = 'worktree' | 'branch';

export type ReviewedMark = {
  path: string;
  fingerprint: string;
  reviewedAt: string;
};

export type ReviewedFileMark = ReviewedMark & {
  stale: boolean;
};

export type ReviewedFiles = {
  worktreeId: string;
  marks: readonly ReviewedMark[];
};

export type ReviewedFile = {
  path: string;
  fingerprint: string;
};

export type ReviewedFileConflict = {
  path: string;
  reason: 'stale' | 'missing';
};

export type ReviewedFileSelection = {
  marked: readonly ReviewedFile[];
  conflicts: readonly ReviewedFileConflict[];
};

export type ReviewedFileLimits = {
  marksPerWorktree: number;
  marksPerBranch?: number | undefined;
};

export type ReviewedLayerMark = {
  layerId: string;
  fingerprint: string;
  reviewedAt: string;
};

export type ListedReviewedLayerMark = ReviewedLayerMark & { stale: boolean };

export type ReviewedLayers = {
  worktreeId: string;
  marks: readonly ListedReviewedLayerMark[];
};

export type WorktreeReviewedLayerMark = ReviewedLayerMark & {
  worktreeId: string;
};

export type ReviewedFileKey = (
  | { worktreeId: string; reviewId?: never }
  | { reviewId: string; worktreeId?: never }
) & {
  scope?: ReviewedScope | undefined;
  branch?: string | undefined;
};

export type ReviewedFileSave = ReviewedFileKey & {
  marks: readonly ReviewedFileMark[];
};

export type ReviewedFileRemoval = ReviewedFileKey & {
  fingerprint?: string | undefined;
  paths: readonly string[];
};

export type ReviewedFileStaleness = {
  worktreeId: string;
  scope?: ReviewedScope | undefined;
  branch?: string | undefined;
} & {
  paths: readonly string[];
  stale: boolean;
};

export type ReviewedLayerSave = {
  reviewId: string;
  marks: readonly ReviewedLayerMark[];
};

export type ReviewedLayerRemoval = {
  reviewId: string;
  layerId: string;
  fingerprint: string;
};
