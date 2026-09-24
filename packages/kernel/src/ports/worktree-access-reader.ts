import type {
  Worktree,
  WorktreeCheck,
  WorktreeKey,
} from '../models/worktree.ts';

export interface WorktreeAccessReader<Found extends Worktree = Worktree> {
  known(
    input: WorktreeKey,
    signal?: AbortSignal,
  ): Promise<WorktreeCheck<Found>>;
}
