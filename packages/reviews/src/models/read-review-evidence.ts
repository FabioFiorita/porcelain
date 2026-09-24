import type {
  ChangeComparison,
  FileChange,
  TrackedComparison,
} from '@porcelain/kernel/models';
import type { ReviewEvidence } from './review-evidence.ts';
import type { LayerDraft } from './review.ts';

export type ReadReviewEvidenceInput = {
  worktreeId: string;
  layers: readonly Pick<LayerDraft, 'steps'>[];
};

export type ReadReviewEvidenceResult = ReviewEvidence;

export type ReadReviewStatusInput = { worktreeId: string };

export type ReviewStatus = { changes: ChangeComparison[] };

export type ReadReviewFingerprintsInput = {
  worktreeId: string;
  comparisons: readonly ChangeComparison[];
  paths: readonly string[] | undefined;
};

export type ReviewFingerprints = { changes: FileChange[] };

export type ReadReviewTextInput = { worktreeId: string; path: string };

export type ReadReviewDiffsInput = {
  worktreeId: string;
  comparisons: readonly TrackedComparison[];
};
