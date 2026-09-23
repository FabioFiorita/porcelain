export type Worktree = {
  id: string;
  projectId: string;
};

export type CheckWorktreeAccessInput = {
  worktreeId: string;
  intent: 'read' | 'write';
};

export type WorktreeCheck =
  | { outcome: 'found'; worktree: Worktree }
  | { outcome: 'missing' }
  | { outcome: 'unavailable' };
