export type Worktree = {
  id: string;
  projectId: string;
};

export type CheckWorktreeAccessInput = {
  worktreeId: string;
  intent: 'read' | 'write';
};
