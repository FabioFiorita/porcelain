import type { BranchDetails, BranchStatus } from './change-status.ts';

export type ReadBranchDetailsInput = {
  worktreeId: string;
  branch: BranchStatus | undefined;
  headOid: string | undefined;
};

export type ReadBranchDetailsResult = BranchDetails;
