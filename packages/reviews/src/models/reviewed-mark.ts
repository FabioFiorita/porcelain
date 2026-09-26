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
  marks: ReviewedMark[];
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
  marked: ReviewedFile[];
  conflicts: ReviewedFileConflict[];
};

export type ReviewedFileLimits = {
  marksPerWorktree: number;
};

export type ReviewedLayerMark = {
  layerId: string;
  fingerprint: string;
  reviewedAt: string;
};

export type ListedReviewedLayerMark = ReviewedLayerMark & { stale: boolean };

export type ReviewedLayers = {
  worktreeId: string;
  marks: ListedReviewedLayerMark[];
};

export type WorktreeReviewedLayerMark = ReviewedLayerMark & {
  worktreeId: string;
};

export type ReviewedFileSave = {
  worktreeId: string;
  marks: readonly ReviewedFileMark[];
};

export type ReviewedFileRemoval = {
  worktreeId: string;
  paths: readonly string[];
};

export type ReviewedFileStaleness = {
  worktreeId: string;
  paths: readonly string[];
  stale: boolean;
};

export type ReviewedLayerSave = {
  worktreeId: string;
  marks: readonly ReviewedLayerMark[];
};

export type ReviewedLayerRemoval = { worktreeId: string; layerId: string };
