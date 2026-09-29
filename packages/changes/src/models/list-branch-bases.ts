import type { BranchBases } from './branch-changes.ts';

export type ListBranchBasesInput = {
  worktreeId: string;
};

export type ListBranchBasesResult = BranchBases;
