export type ConflictKind =
  | 'both-deleted'
  | 'added-by-us'
  | 'deleted-by-them'
  | 'added-by-them'
  | 'deleted-by-us'
  | 'both-added'
  | 'both-modified';

export type CommitDraftComparison =
  | {
      scope: 'staged' | 'unstaged';
      kind: 'added' | 'modified' | 'deleted' | 'renamed' | 'type-changed';
      oldPath: string | undefined;
      newPath: string | undefined;
      oldMode: string;
      newMode: string;
      oldOid: string | undefined;
      newOid: string | undefined;
      supported: boolean;
    }
  | { scope: 'untracked'; path: string }
  | {
      scope: 'unmerged';
      path: string;
      conflict: ConflictKind;
      modes: [string, string, string, string];
      oids: [string, string, string];
    };

export type CommitDraftChange = {
  path: string;
  fingerprint: string | undefined;
  comparisons: CommitDraftComparison[];
};

export type CommitDraftObservation = {
  statusToken: string;
  headOid: string | undefined;
  changes: CommitDraftChange[];
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
