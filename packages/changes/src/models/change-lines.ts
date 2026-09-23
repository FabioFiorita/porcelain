export type ChangeLineRange = {
  path: string;
  from: number;
  to: number;
  at: 'head' | 'worktree';
};

export type ChangeLines = {
  environmentId: string;
  worktreeId: string;
  at: ChangeLineRange['at'];
  path: string;
  from: number;
  to: number;
  lines: string[];
};
