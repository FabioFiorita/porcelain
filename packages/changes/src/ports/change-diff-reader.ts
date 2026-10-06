import { type GitIoFailure } from '@porcelain/git/errors';
import { type Effect, Context } from 'effect';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import { type ChangeDiffContent } from '../models/change-diff.ts';
import { type ReadChangeDiffsInput } from '../models/read-change-diffs.ts';

export interface ChangeDiffReader {
  readDiffs(
    input: ReadChangeDiffsInput,
  ): Effect.Effect<ChangeDiffContent[], GitIoFailure, WorktreeRead>;
}

export const ChangeDiffReader = Context.Service<
  '@porcelain/changes/ChangeDiffReader',
  ChangeDiffReader
>('@porcelain/changes/ChangeDiffReader');
