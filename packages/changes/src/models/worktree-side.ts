export type WorktreeSide = {
  digest?: string | undefined;
  symlink?: string | undefined;
  submodule?: string | undefined;
};

export type WorktreeEntry =
  | { kind: 'file'; digest: string; stamp: string }
  | { kind: 'symlink'; target: string; stamp: string }
  | { kind: 'too-large' }
  | { kind: 'unreadable' }
  | { kind: 'other' };

export type WorktreeEntriesRequest = {
  worktreeId: string;
  paths: readonly string[];
  maxDigestBytes: number;
};

export type SubmoduleHeadsRequest = {
  worktreeId: string;
  paths: readonly string[];
};

export type StagingStampRequest = { worktreeId: string };

export type SidePaths = {
  files: string[];
  submodules: string[];
};

export type ObservedSides = {
  sides: ReadonlyMap<string, WorktreeSide>;
  stamps: ReadonlyMap<string, string>;
};
