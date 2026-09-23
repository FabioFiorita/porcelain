import type { Worktree } from '../models/worktree.ts';

export interface WorktreeAccess {
  known(worktreeId: string, signal?: AbortSignal): Promise<Worktree>;
  forWriting(worktreeId: string, signal?: AbortSignal): Promise<Worktree>;
}
