import type {
  WorktreePathsRead,
  WorktreePathsReadInput,
} from '../models/worktree-paths-read.ts';

export interface WorktreePathsReader {
  read(
    input: WorktreePathsReadInput,
    signal?: AbortSignal,
  ): Promise<WorktreePathsRead>;
}
