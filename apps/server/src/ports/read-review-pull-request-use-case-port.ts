import { Context, type Effect } from 'effect';
import type { ReadPullRequestResponse } from '@porcelain/contracts/reviews';
import type { ReviewNotFoundError } from '@porcelain/reviews/errors';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
export interface ReadReviewPullRequestUseCasePort {
  readonly execute: (input: {
    reviewId: string;
  }) => Effect.Effect<
    ReadPullRequestResponse,
    ReviewNotFoundError | ProjectNotFoundError
  >;
}
export const ReadReviewPullRequestUseCasePort = Context.Service<
  '@porcelain/server/ReadReviewPullRequestUseCasePort',
  ReadReviewPullRequestUseCasePort
>('@porcelain/server/ReadReviewPullRequestUseCasePort');
