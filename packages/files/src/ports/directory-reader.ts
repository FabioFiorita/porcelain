import { type WorktreeRead } from '@porcelain/effects/worktree';
import { type Effect, Context } from 'effect';
import {
  type DirectoryRead,
  type DirectoryReadInput,
} from '../models/directory-read.ts';

export interface DirectoryReader {
  list(
    input: DirectoryReadInput,
  ): Effect.Effect<DirectoryRead, never, WorktreeRead>;
}

export const DirectoryReader = Context.Service<
  '@porcelain/files/DirectoryReader',
  DirectoryReader
>('@porcelain/files/DirectoryReader');
