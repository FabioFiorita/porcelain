export type CommitDraftComparison =
  | {
      scope: 'staged' | 'unstaged';
      kind: 'added' | 'modified' | 'deleted' | 'renamed' | 'type-changed';
      oldPath: string | null;
      newPath: string | null;
      oldMode: string;
      newMode: string;
      oldOid: string | null;
      newOid: string | null;
      supported: boolean;
    }
  | { scope: 'untracked'; path: string }
  | {
      scope: 'unmerged';
      path: string;
      conflict: 'DD' | 'AU' | 'UD' | 'UA' | 'DU' | 'AA' | 'UU';
      modes: [string, string, string, string];
      oids: [string, string, string];
    };

export type CommitDraftChange = {
  path: string;
  fingerprint: string | null;
  comparisons: CommitDraftComparison[];
};

export type CommitDraftObservation = {
  statusToken: string;
  headOid: string | null;
  changes: CommitDraftChange[];
};

export type CommitDraftUntrackedContent =
  | {
      kind: 'file';
      contentFingerprint?: string;
      worktreeId: string;
      path: string;
      encoding: 'utf-8';
      byteLength: number;
      text: string;
    }
  | { kind: 'omitted'; reason: string };
