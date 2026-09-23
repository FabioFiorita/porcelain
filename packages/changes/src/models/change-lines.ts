export type ChangeLineRange = {
  path: string;
  from: number;
  to: number;
  at: 'head' | 'worktree';
};

export type ChangeLines = ChangeLineRange & { lines: string[] };
