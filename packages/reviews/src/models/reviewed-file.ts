export type ReviewedMark = {
  path: string;
  fingerprint: string;
  reviewedAt: string;
};

export type SetReviewedFileInput = {
  path: string;
  reviewed: true;
  fingerprint: string;
};

export type SetReviewedFilesInput = {
  files: { path: string; fingerprint: string }[];
};

export type ReviewedFileChange = {
  path: string;
  fingerprint?: string;
};

export type ReviewedFilesResult = {
  worktreeId: string;
  marks: ReviewedMark[];
};

export type SetReviewedFilesResult = ReviewedFilesResult & {
  marked: string[];
  conflicts: { path: string; reason: 'stale' | 'missing' }[];
};
