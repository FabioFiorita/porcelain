import { Context, type Effect } from 'effect';
import type {
  ReadPullRequestResponse,
  ReviewParams,
} from '@porcelain/contracts/reviews';
import type { ReviewNotFoundError } from '@porcelain/reviews/errors';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import type { GitHubRepository } from '@porcelain/reviews/models';
export type ReviewGitHubTarget =
  | Exclude<ReadPullRequestResponse, { kind: 'available' }>
  | {
      kind: 'available';
      repository: GitHubRepository;
      account: string;
      number: number;
      url: string;
    };
export interface ReadReviewGitHubTargetUseCasePort {
  readonly execute: (
    input: ReviewParams,
  ) => Effect.Effect<
    ReviewGitHubTarget,
    ReviewNotFoundError | ProjectNotFoundError
  >;
}
export const ReadReviewGitHubTargetUseCasePort = Context.Service<
  '@porcelain/server/ReadReviewGitHubTargetUseCasePort',
  ReadReviewGitHubTargetUseCasePort
>('@porcelain/server/ReadReviewGitHubTargetUseCasePort');
