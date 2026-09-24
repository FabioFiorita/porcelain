import type { ChangeDiffContent } from '../models/change-diff.ts';
import type { ReadChangeDiffsInput } from '../models/read-change-diffs.ts';

export interface ChangeDiffReader {
  readDiffs(
    input: ReadChangeDiffsInput,
    signal?: AbortSignal,
  ): Promise<ChangeDiffContent[]>;
}
