export type ChangeComparison =
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

export type WorktreeSide = {
  digest?: string | undefined;
  symlink?: string | undefined;
  submodule?: string | undefined;
};

export type WorktreeEntry =
  | { kind: 'file'; digest: string; stamp: string }
  | { kind: 'symlink'; target: string; stamp: string }
  | { kind: 'other' };

export type FileChange = {
  path: string;
  fingerprint: string | undefined;
  comparisons: ChangeComparison[];
};
