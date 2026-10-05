import type { WorktreeRead } from '@porcelain/effects/worktree';
import type { Effect } from 'effect';
import type {
  DirectoryRead,
  DirectoryReadInput,
} from '../models/directory-read.ts';

export interface DirectoryReader {
  list(
    input: DirectoryReadInput,
  ): Effect.Effect<DirectoryRead, never, WorktreeRead>;
}
