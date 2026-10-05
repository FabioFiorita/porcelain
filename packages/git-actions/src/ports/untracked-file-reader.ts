import { type WorktreeRead } from '@porcelain/effects/worktree';
import { type Effect, Context } from 'effect';
import {
  type UntrackedFileRead,
  type UntrackedFileRequest,
} from '../models/commit-draft-evidence.ts';

export interface UntrackedFileReader {
  read(
    input: UntrackedFileRequest,
  ): Effect.Effect<UntrackedFileRead, never, WorktreeRead>;
}

export const UntrackedFileReader = Context.Service<
  '@porcelain/git-actions/UntrackedFileReader',
  UntrackedFileReader
>('@porcelain/git-actions/UntrackedFileReader');
