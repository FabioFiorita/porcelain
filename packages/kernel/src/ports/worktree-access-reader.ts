import { type Effect } from 'effect';
import type {
  Worktree,
  WorktreeCheck,
  WorktreeKey,
} from '../models/worktree.ts';

export interface WorktreeAccessReader<Found extends Worktree = Worktree> {
  known(input: WorktreeKey): Effect.Effect<WorktreeCheck<Found>>;
}
