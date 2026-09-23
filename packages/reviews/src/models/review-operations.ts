import type {
  ReadChangesResult,
  ReviewFiles,
  ReviewPatch,
} from './review-evidence.ts';
import type { ResolvedReview } from './resolved-review.ts';
import type { LayerDraft, Review, ReviewDraft, ReviewLayer } from './review.ts';

export type PublishReviewInput = {
  worktreeId: string;
  draft: ReviewDraft;
  files: ReviewFiles;
};
export type PublishReviewResult = Review;

export type ReadPublishedReviewInput = { worktreeId: string };
export type ReadPublishedReviewResult = Review | undefined;

export type ReadReviewFilesInput = {
  worktreeId: string;
  layers: readonly (LayerDraft | ReviewLayer)[];
  changes?: ReadChangesResult | undefined;
};
export type ReadReviewFilesResult = ReviewFiles;

export type ReadReviewChangesInput = { worktreeId: string };
export type ReadReviewChangesResult = ReadChangesResult | undefined;

export type ReadReviewPatchesInput = {
  changes: ReadChangesResult | undefined;
};
export type ReadReviewPatchesResult = ReviewPatch[] | undefined;

export type ResolvePublishedReviewInput = {
  review: Review;
  files: ReviewFiles;
  changes: ReadChangesResult | undefined;
  patches: readonly ReviewPatch[] | undefined;
};
export type ResolvePublishedReviewResult = ResolvedReview;

export type RecordReviewActivityInput = {
  review: Review;
  active: boolean;
};
export type RecordReviewActivityResult = void;

export type ReadReviewSummaryInput = {
  token: string;
  expires: number;
  signature: string;
};
export type ReadReviewSummaryResult = string | undefined;

export type ReadCurrentChangesInput = { worktreeId: string };
export type ReadCurrentChangesResult = ReadChangesResult;
