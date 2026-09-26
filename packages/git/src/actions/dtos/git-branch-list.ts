export type GitBranchList = {
  current: string | null;
  branches: {
    name: string;
    upstream: string | null;
    lastCommitAt: string;
    checkedOutElsewhere: boolean;
  }[];
};
