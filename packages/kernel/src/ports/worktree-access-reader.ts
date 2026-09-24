import type { Worktree, WorktreeCheck } from '../models/worktree.ts';

export interface WorktreeAccessReader<Found extends Worktree = Worktree> {
  known(
    input: { worktreeId: string },
    signal?: AbortSignal,
  ): Promise<WorktreeCheck<Found>>;
  forWriting(
    input: { worktreeId: string },
    signal?: AbortSignal,
  ): Promise<WorktreeCheck<Found>>;
}
