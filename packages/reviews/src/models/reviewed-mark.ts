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
  stale: boolean;
};

export type ReviewedLayers = {
  worktreeId: string;
  marks: ReviewedLayerMark[];
};

export type WorktreeReviewedLayerMark = ReviewedLayerMark & {
  worktreeId: string;
};
