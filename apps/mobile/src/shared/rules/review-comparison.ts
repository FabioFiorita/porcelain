export type ReviewComparison =
  | { kind: 'worktree' }
  | { kind: 'branch'; base?: string };
