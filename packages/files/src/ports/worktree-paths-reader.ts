import type { WorktreePathsRead } from '../models/worktree-paths.ts';

export interface WorktreePathsReader {
  read(worktreeId: string, signal?: AbortSignal): Promise<WorktreePathsRead>;
}
