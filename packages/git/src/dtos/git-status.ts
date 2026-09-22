export interface GitChangeSelection {
  scope: 'staged' | 'unstaged';
  oldPath: string | null;
  newPath: string | null;
}

export interface GitOrdinaryChange extends GitChangeSelection {
  kind: 'added' | 'modified' | 'deleted' | 'renamed' | 'type-changed';
  oldMode: string;
  newMode: string;
  /**
   * What each side of the comparison is, as Git already knows it: the object
   * ids printed in the status. The worktree side of an unstaged change has
   * none — nothing has hashed it yet — so it is null and the caller hashes the
   * file when it needs to say whether the content is still the same.
   */
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
      /** Index stages and worktree mode used for optimistic action fingerprints. */
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
