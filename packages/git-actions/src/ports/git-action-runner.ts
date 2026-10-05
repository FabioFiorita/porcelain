import type { WorktreeRead, WorktreeWrite } from '@porcelain/effects/worktree';
import type { Effect } from 'effect';
import type {
  GitActionRunnerOutcome,
  GitActionRunRequest,
} from '../models/git-action-run.ts';

export interface GitActionRunner<E = never> {
  run(
    input: GitActionRunRequest,
  ): Effect.Effect<GitActionRunnerOutcome, E, WorktreeRead | WorktreeWrite>;
}
