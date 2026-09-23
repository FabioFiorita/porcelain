export interface Worktree {
  id: string;
}

export type WorktreeCheck =
  | { outcome: 'found'; worktree: Worktree }
  | { outcome: 'missing' }
  | { outcome: 'unavailable' };
