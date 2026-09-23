import type { TrackedComparison } from '../models/change.ts';
import type { ChangeDiffContent } from '../models/change-diff.ts';

export interface ChangeDiffReader {
  readDiffs(
    worktreeId: string,
    comparisons: readonly TrackedComparison[],
    signal?: AbortSignal,
  ): Promise<ChangeDiffContent[]>;
}
