import type { FileChange } from '@porcelain/kernel/models';

export type CommitDraftObservation = {
  headOid: string | undefined;
  changes: FileChange[];
};

export type CommitDraftUntrackedContent =
  | {
      kind: 'file';
      worktreeId: string;
      path: string;
      encoding: 'utf-8';
      byteLength: number;
      text: string;
    }
  | { kind: 'omitted'; reason: string };

export type SelectedDiffRequest = {
  worktreeId: string;
  headOid: string | undefined;
  paths: string[];
};

export type UntrackedFileRequest = {
  worktreeId: string;
  path: string;
  maxBytes: number;
};

export type UntrackedFileRead =
  | { kind: 'text'; text: string; byteLength: number }
  | { kind: 'too-large' }
  | { kind: 'failed'; failure: string };
