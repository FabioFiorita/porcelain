export interface GitChangeSelection {
  scope: 'staged' | 'unstaged';
  oldPath: string | null;
  newPath: string | null;
}

export interface GitOrdinaryChange extends GitChangeSelection {
  kind: 'added' | 'modified' | 'deleted' | 'renamed' | 'type-changed';
  oldMode: string;
  newMode: string;
  supported: boolean;
}

export type GitChange =
  | GitOrdinaryChange
  | { scope: 'untracked'; path: string }
  | {
      scope: 'unmerged';
      path: string;
      conflict: 'DD' | 'AU' | 'UD' | 'UA' | 'DU' | 'AA' | 'UU';
    };

export type GitBranchStatus = {
  name: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  remoteName?: string | null;
  sourceRef?: string | null;
  stashes?: { oid: string; message: string }[];
};

export interface GitStatusObservation {
  branch?: GitBranchStatus;
  statusToken: string;
  headOid: string | null;
  changes: GitChange[];
}
