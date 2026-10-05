import { type GitIoFailure } from '@porcelain/git/errors';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import { type Effect, Context } from 'effect';
import { type SelectedDiffRequest } from '../models/commit-draft-evidence.ts';

export interface SelectedDiffReader {
  read(
    input: SelectedDiffRequest,
  ): Effect.Effect<string, GitIoFailure, WorktreeRead>;
}

export const SelectedDiffReader = Context.Service<
  '@porcelain/git-actions/SelectedDiffReader',
  SelectedDiffReader
>('@porcelain/git-actions/SelectedDiffReader');
