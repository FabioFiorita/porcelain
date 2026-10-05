import type { WorktreeRead } from '@porcelain/effects/worktree';
import type { Effect } from 'effect';
import type { SelectedDiffRequest } from '../models/commit-draft-evidence.ts';

export interface SelectedDiffReader<E = never> {
  read(input: SelectedDiffRequest): Effect.Effect<string, E, WorktreeRead>;
}
