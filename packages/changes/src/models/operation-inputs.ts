import type {
  ChangeComparison,
  ChangeFingerprints,
  FileChange,
  TrackedComparison,
} from './change.ts';
import type { ChangeSelection, ExpectedFile } from './change-diff.ts';
import type { ChangeLineRange } from './change-lines.ts';
import type { BranchStatus, ChangeStatusObservation } from './change-status.ts';
import type {
  CommitFilesRequest,
  CommitPageRequest,
} from './commit-history.ts';

export type WorktreeInput = { worktreeId: string };

export type ReadBranchDetailsInput = WorktreeInput & {
  branch: BranchStatus | undefined;
  headOid: string | undefined;
};

export type ReadChangeFingerprintsInput = WorktreeInput & {
  comparisons: readonly ChangeComparison[];
  paths: readonly string[] | undefined;
};

export type SelectDiffComparisonsInput = {
  expectedFiles: readonly ExpectedFile[];
  selections: readonly ChangeSelection[];
  status: ChangeStatusObservation;
};

export type ConfirmDiffObservationInput = {
  expectedStatusToken: string;
  expectedFiles: readonly ExpectedFile[];
  statusToken: string;
  fingerprints: ChangeFingerprints;
  previousStamp: string | undefined;
};

export type ReadChangeDiffsInput = WorktreeInput & {
  comparisons: readonly TrackedComparison[];
};

export type ReadChangeLinesInput = WorktreeInput & ChangeLineRange;

export type ListCommitsInput = WorktreeInput & CommitPageRequest;

export type ReadCommitFilesInput = WorktreeInput & CommitFilesRequest;

export type ReadCommitDiffsInput = ReadCommitFilesInput & {
  paths: string[][];
};

export type ReconcileReviewedFilesInput = WorktreeInput & {
  changes: readonly FileChange[];
};

export type DescribeWorktreeStateInput = {
  changes: readonly FileChange[];
  branch: BranchStatus | undefined;
};
