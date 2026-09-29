import type { BranchChanges } from './branch-changes.ts';

export type ReadBranchChangesInput = {
  worktreeId: string;
  base: string | undefined;
};

export type ReadBranchChangesResult = BranchChanges;
