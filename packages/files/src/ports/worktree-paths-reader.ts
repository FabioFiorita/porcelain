import { type WorktreeRead } from '@porcelain/effects/worktree';
import { type Effect, Context } from 'effect';
import {
  type WorktreePathsRead,
  type WorktreePathsReadInput,
} from '../models/worktree-paths-read.ts';

export interface WorktreePathsReader {
  read(
    input: WorktreePathsReadInput,
  ): Effect.Effect<WorktreePathsRead, never, WorktreeRead>;
}

export const WorktreePathsReader = Context.Service<
  '@porcelain/files/WorktreePathsReader',
  WorktreePathsReader
>('@porcelain/files/WorktreePathsReader');
