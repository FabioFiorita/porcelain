import type { BranchDiffs } from './branch-changes.ts';

export type ReadBranchDiffsInput = {
  worktreeId: string;
  baseOid: string;
  headOid: string;
  paths: readonly (readonly string[])[];
};

export type ReadBranchDiffsResult = BranchDiffs;
