import type { InvalidateReviewedMarksInput } from '@porcelain/reviews/models';
import type { Effect } from 'effect';
import type { WorktreeAccessFailure } from './worktree-access-failure.ts';

export interface InvalidateReviewedMarksUseCasePort {
  execute(
    input: InvalidateReviewedMarksInput,
  ): Effect.Effect<void, WorktreeAccessFailure>;
}
