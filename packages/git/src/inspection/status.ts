export interface GitChangeSelection {
  scope: 'staged' | 'unstaged';
  oldPath: string | null;
  newPath: string | null;
}

export interface GitOrdinaryChange extends GitChangeSelection {
  kind: 'added' | 'modified' | 'deleted' | 'renamed' | 'type-changed';
  oldMode: string;
  newMode: string;
  oldOid: string | null;
  newOid: string | null;
  supported: boolean;
}

export type GitChange =
  | GitOrdinaryChange
  | { scope: 'untracked'; path: string }
  | {
      scope: 'unmerged';
      path: string;
      conflict: 'DD' | 'AU' | 'UD' | 'UA' | 'DU' | 'AA' | 'UU';
      modes: [string, string, string, string];
      oids: [string, string, string];
    };

export type GitBranchStatus = {
  name: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  remoteName?: string | null;
  sourceRef?: string | null;
  upstreamOid?: string | null;
  stashes?: { oid: string; message: string }[];
  discarded?: {
    oid: string;
    path: string;
    kind: 'hunk' | 'rename';
  }[];
};

export interface GitStatusObservation {
  branch?: GitBranchStatus;
  statusToken: string;
  headOid: string | null;
  inProgress?: 'merge' | 'rebase' | null;
  mergeHeadOid?: string | null;
  headCommit?: { subject: string; body?: string } | null;
  changes: GitChange[];
}
