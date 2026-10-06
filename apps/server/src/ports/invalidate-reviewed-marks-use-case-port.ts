import { type InvalidateReviewedMarksInput } from '@porcelain/reviews/models';
import { type Effect, Context } from 'effect';
import { type WorktreeAccessFailure } from './worktree-access-failure.ts';

export interface InvalidateReviewedMarksUseCasePort {
  execute(
    input: InvalidateReviewedMarksInput,
  ): Effect.Effect<void, WorktreeAccessFailure>;
}

export const InvalidateReviewedMarksUseCasePort = Context.Service<
  '@porcelain/server/InvalidateReviewedMarksUseCasePort',
  InvalidateReviewedMarksUseCasePort
>('@porcelain/server/InvalidateReviewedMarksUseCasePort');
