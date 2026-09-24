import type { CommitDraftCapture } from './commit-draft.ts';
import type { CommitDraftObservation } from './commit-draft-evidence.ts';

export type CaptureCommitDraftInput = {
  worktreeId: string;
  observation: CommitDraftObservation;
  expectedStatusToken: string;
  paths: string[];
};

export type CaptureCommitDraftResult = CommitDraftCapture;
