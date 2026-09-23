import type { CommitDraftCapture, CommitDraftMode } from './commit-draft.ts';
import type { GitActionScope } from './git-action-scope.ts';

export type ListCommitModelsInput = Record<never, never>;

export type CaptureCommitDraftInput = GitActionScope & {
  expectedStatusToken: string;
  paths: string[];
};

export type GenerateCommitDraftInput = {
  capture: CommitDraftCapture;
  mode: CommitDraftMode;
  model: string;
};
