import type { TrackedComparison } from '@porcelain/kernel/models';
import type { ChangeDiff } from './change-diff.ts';

export type ReadChangeDiffsInput = {
  worktreeId: string;
  comparisons: readonly TrackedComparison[];
};

export type ReadChangeDiffsResult = ChangeDiff[];
