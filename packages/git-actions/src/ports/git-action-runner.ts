import { type GitIoFailure } from '@porcelain/git/errors';
import {
  type WorktreeRead,
  type WorktreeWrite,
} from '@porcelain/effects/worktree';
import { type Effect, Context } from 'effect';
import {
  type GitActionRunnerOutcome,
  type GitActionRunRequest,
} from '../models/git-action-run.ts';

export interface GitActionRunner {
  run(
    input: GitActionRunRequest,
  ): Effect.Effect<
    GitActionRunnerOutcome,
    GitIoFailure,
    WorktreeRead | WorktreeWrite
  >;
}

export const GitActionRunner = Context.Service<
  '@porcelain/git-actions/GitActionRunner',
  GitActionRunner
>('@porcelain/git-actions/GitActionRunner');
