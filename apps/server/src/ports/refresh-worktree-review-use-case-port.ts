import { type WorktreeKey } from '@porcelain/kernel/models';
import { type Effect, Context } from 'effect';
import { type GitIoFailure } from '@porcelain/git/errors';
import { type WorktreeAccessFailure } from './worktree-access-failure.ts';
import { type IncompleteDiffReadError } from '@porcelain/changes/errors';

export interface RefreshWorktreeReviewUseCasePort {
  execute(
    input: WorktreeKey,
  ): Effect.Effect<
    void,
    GitIoFailure | WorktreeAccessFailure | IncompleteDiffReadError
  >;
}

export const RefreshWorktreeReviewUseCasePort = Context.Service<
  '@porcelain/server/RefreshWorktreeReviewUseCasePort',
  RefreshWorktreeReviewUseCasePort
>('@porcelain/server/RefreshWorktreeReviewUseCasePort');
