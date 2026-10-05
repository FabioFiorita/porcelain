import type { WorktreeKey } from '@porcelain/kernel/models';
import type { Effect } from 'effect';
import type { GitIoFailure } from './git-io-failure.ts';
import type { WorktreeAccessFailure } from './worktree-access-failure.ts';
import type { IncompleteDiffReadError } from '@porcelain/changes/errors';

export interface RefreshWorktreeReviewUseCasePort {
  execute(
    input: WorktreeKey,
  ): Effect.Effect<
    void,
    GitIoFailure | WorktreeAccessFailure | IncompleteDiffReadError
  >;
}
