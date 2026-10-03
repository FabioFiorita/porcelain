import type {
  CommitDraft,
  CommitDraftCapture,
  CommitDraftMode,
  CommitGroupLimits,
} from './commit-draft.ts';

export type GenerateCommitDraftInput = {
  capture: CommitDraftCapture;
  mode: CommitDraftMode;
  model: string;
};

export type GenerateCommitDraftResult = CommitDraft;

export type GenerateCommitDraftOptions = CommitGroupLimits;
