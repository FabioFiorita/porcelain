import type { BranchDiffs } from './branch-changes.ts';

export type ReadBranchDiffsInput = {
  worktreeId: string;
  baseOid: string;
  headOid: string;
  paths: string[][];
};

export type ReadBranchDiffsResult = BranchDiffs;
