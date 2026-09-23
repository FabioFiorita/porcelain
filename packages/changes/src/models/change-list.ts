import type { FileChange } from './change.ts';
import type { BranchStatus } from './change-status.ts';

export type ReadChangesResult = {
  environmentId: string;
  worktreeId: string;
  statusToken: string;
  headOid: string | undefined;
  inProgress: 'merge' | 'rebase' | undefined;
  mergeHeadOid: string | undefined;
  branch: BranchStatus | undefined;
  changes: FileChange[];
};
