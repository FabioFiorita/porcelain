import type { WorktreeCheck } from '../models/worktree.ts';

export interface WorktreeAccess {
  known(worktreeId: string, signal?: AbortSignal): Promise<WorktreeCheck>;
  forWriting(worktreeId: string, signal?: AbortSignal): Promise<WorktreeCheck>;
}
