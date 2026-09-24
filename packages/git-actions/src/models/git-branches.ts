type GitBranch = {
  name: string;
  upstream: string | undefined;
  lastCommitAt: string;
  checkedOutElsewhere: boolean;
};

export type GitBranches = {
  current: string | undefined;
  branches: GitBranch[];
};
