import type { TrackedComparison } from '@porcelain/kernel/models';
import type { ChangeDiffContent } from '../models/change-diff.ts';

export interface ChangeDiffReader {
  readDiffs(
    worktreeId: string,
    comparisons: readonly TrackedComparison[],
    signal?: AbortSignal,
  ): Promise<ChangeDiffContent[]>;
}
