export type WorktreeEntry =
  | { kind: 'file'; digest: string; stamp: string }
  | { kind: 'symlink'; target: string; stamp: string }
  | { kind: 'other' };

export type WorktreeFiles = (
  root: string,
  paths: readonly string[],
) => Promise<Map<string, WorktreeEntry>>;

export type StampPath = (path: string) => Promise<string | null>;
