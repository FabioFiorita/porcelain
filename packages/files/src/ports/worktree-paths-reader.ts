import type { WorktreeRead } from '@porcelain/effects/worktree';
import type { Effect } from 'effect';
import type {
  WorktreePathsRead,
  WorktreePathsReadInput,
} from '../models/worktree-paths-read.ts';

export interface WorktreePathsReader {
  read(
    input: WorktreePathsReadInput,
  ): Effect.Effect<WorktreePathsRead, never, WorktreeRead>;
}
