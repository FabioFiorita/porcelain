export type WorktreeSide = {
  digest?: string | undefined;
  symlink?: string | undefined;
  submodule?: string | undefined;
};

export type WorktreeEntry =
  | { kind: 'file'; digest: string; stamp: string }
  | { kind: 'symlink'; target: string; stamp: string }
  | { kind: 'other' };

export type SidePaths = {
  files: string[];
  submodules: string[];
};

export type ObservedSides = {
  sides: ReadonlyMap<string, WorktreeSide>;
  stamps: ReadonlyMap<string, string>;
};
