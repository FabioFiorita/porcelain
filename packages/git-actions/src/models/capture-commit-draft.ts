import type { CommitDraftCapture } from './commit-draft.ts';
import type { CommitDraftObservation } from './commit-draft-evidence.ts';

export type CaptureCommitDraftInput = {
  worktreeId: string;
  observation: CommitDraftObservation;
  paths: string[];
};

export type CaptureCommitDraftResult = CommitDraftCapture;

export type CaptureCommitDraftOptions = {
  maxComparisons: number;
  maxEvidenceBytes: number;
  maxUntrackedBytes: number;
};
