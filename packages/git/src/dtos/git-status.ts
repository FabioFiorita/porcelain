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

export interface GitStatusObservation {
  statusToken: string;
  headOid: string | null;
  changes: GitChange[];
}
