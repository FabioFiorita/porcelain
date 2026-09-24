export type GitChangeSelection = {
  scope: 'staged' | 'unstaged';
  oldPath: string | null;
  newPath: string | null;
};

export type GitOrdinaryChange = GitChangeSelection & {
  kind: 'added' | 'modified' | 'deleted' | 'renamed' | 'type-changed';
  oldMode: string;
  newMode: string;
  oldOid: string | null;
  newOid: string | null;
  supported: boolean;
};

export type GitConflictCode = 'DD' | 'AU' | 'UD' | 'UA' | 'DU' | 'AA' | 'UU';

export type GitChange =
  | GitOrdinaryChange
  | { scope: 'untracked'; path: string }
  | {
      scope: 'unmerged';
      path: string;
      conflict: GitConflictCode;
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
  discarded?: GitDiscardedChange[];
};

export type GitDiscardedChange = {
  oid: string;
  path: string;
  kind: 'hunk' | 'rename';
};

export type GitBranchDetails = {
  remoteName: string | null;
  sourceRef: string | null;
  upstreamOid: string | null;
  stashes: { oid: string; message: string }[];
  discarded: GitDiscardedChange[];
  headCommit: { subject: string; body?: string } | null;
};

export type GitStatusObservation = {
  branch?: GitBranchStatus;
  statusToken: string;
  headOid: string | null;
  inProgress?: 'merge' | 'rebase' | null;
  mergeHeadOid?: string | null;
  headCommit?: { subject: string; body?: string } | null;
  changes: GitChange[];
};
