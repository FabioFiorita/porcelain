export type Worktree = { id: string; projectId: string };

export type WorktreeCheck<Found extends Worktree = Worktree> =
  | { kind: 'found'; worktree: Found }
  | { kind: 'missing' }
  | { kind: 'unavailable' };

export type WorktreeKey = { worktreeId: string };

export type WorktreeKeys = { worktreeIds: readonly string[] };
