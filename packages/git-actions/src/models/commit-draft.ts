import type { ExpectedFile } from './expected-file.ts';

export type CommitModel = { id: string; label: string };

export type CommitGroup = { message: string; paths: string[] };

export type CommitDraftMode = 'message' | 'groups';

export type CommitDraft = {
  groups: CommitGroup[];
  expectedFiles: ExpectedFile[];
};

export type CommitDraftCapture = {
  paths: string[];
  bundles: string[][];
  evidence: string;
  expectedFiles: ExpectedFile[];
};

export type CommitDraftRequest = {
  mode: CommitDraftMode;
  model: string;
  paths: string[];
  evidence: string;
};

export type CommitDraftGeneration =
  | { kind: 'drafted'; groups: CommitGroup[] }
  | { kind: 'unsupported-model' }
  | { kind: 'tool-missing' }
  | { kind: 'tool-failed' }
  | { kind: 'failed' };
