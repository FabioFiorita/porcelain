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
