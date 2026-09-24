import type { Worktree, WorktreeCheck } from '../models/worktree.ts';

export interface WorktreeAccess<Found extends Worktree = Worktree> {
  known(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<WorktreeCheck<Found>>;
  forWriting(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<WorktreeCheck<Found>>;
}
