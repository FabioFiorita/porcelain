export type LineRange = {
  path: string;
  from: number;
  to: number;
  at: 'head' | 'worktree';
};
