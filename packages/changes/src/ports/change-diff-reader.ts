import type { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import type { ChangeDiffContent } from '../models/change-diff.ts';
import type { ReadChangeDiffsInput } from '../models/read-change-diffs.ts';

export interface ChangeDiffReader<E = never> {
  readDiffs(
    input: ReadChangeDiffsInput,
  ): Effect.Effect<ChangeDiffContent[], E, WorktreeRead>;
}
