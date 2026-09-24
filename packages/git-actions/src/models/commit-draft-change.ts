import type { FileChange } from '@porcelain/kernel/models';

export type CommitDraftObservation = {
  statusToken: string;
  headOid: string | undefined;
  changes: FileChange[];
};

export type CommitDraftUntrackedContent =
  | {
      kind: 'file';
      contentFingerprint?: string | undefined;
      worktreeId: string;
      path: string;
      encoding: 'utf-8';
      byteLength: number;
      text: string;
    }
  | { kind: 'omitted'; reason: string };
