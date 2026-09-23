export type Worktree = { id: string; projectId: string };

export type WorktreeCheck =
  | { outcome: 'found'; worktree: Worktree }
  | { outcome: 'missing' }
  | { outcome: 'unavailable' };
