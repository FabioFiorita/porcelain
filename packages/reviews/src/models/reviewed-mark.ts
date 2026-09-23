import type { ReadChangesResult, ReviewFiles } from './review-evidence.ts';
import type { Review } from './review.ts';

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

export type ReviewedFileConflict = {
  path: string;
  reason: 'stale' | 'missing';
};

export type ReviewedFileSelection = {
  marked: { path: string; fingerprint: string }[];
  conflicts: ReviewedFileConflict[];
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

export type ListReviewedFilesInput = { worktreeId: string };
export type ListReviewedFilesResult = ReviewedFiles;

export type SetReviewedFilesInput = {
  worktreeId: string;
  files: readonly { path: string; fingerprint: string }[];
  changes: ReadChangesResult;
  onConflict: 'report' | 'refuse';
};
export type SetReviewedFilesResult = ReviewedFiles & {
  marked: string[];
  conflicts: ReviewedFileConflict[];
};

export type RemoveReviewedFileInput = { worktreeId: string; path: string };
export type RemoveReviewedFileResult = ReviewedFiles;

export type ReconcileReviewedFilesInput = {
  worktreeId: string;
  fingerprints: ReadonlyMap<string, string | undefined>;
};
export type ReconcileReviewedFilesResult = void;

export type InvalidateReviewedMarksInput = {
  worktreeId: string;
  paths?: readonly string[] | undefined;
};
export type InvalidateReviewedMarksResult = void;

export type ListReviewedLayersInput = { worktreeId: string };
export type ListReviewedLayersResult = ReviewedLayers;

export type SetReviewedLayerInput = {
  worktreeId: string;
  layerId: string;
  fingerprint: string;
  review: Review | undefined;
  files: ReviewFiles;
};
export type SetReviewedLayerResult = ReviewedLayers;

export type RemoveReviewedLayerInput = { worktreeId: string; layerId: string };
export type RemoveReviewedLayerResult = ReviewedLayers;
