import { Context, type Effect } from 'effect';
import type { GitHubReadError } from '../errors/github-read-error.ts';
import type { PullRequestReviewFailedError } from '../errors/pull-request-review-failed-error.ts';
import type {
  InlineReviewComment,
  PostedReview,
  PullRequestDiff,
} from '../models/draft-comment.ts';
import type { GitHubRepository } from '../models/pull-request.ts';

type PullRequestTarget = GitHubRepository & {
  readonly account: string;
  readonly number: number;
};

export interface PullRequestReviewer {
  diff(
    input: PullRequestTarget,
  ): Effect.Effect<PullRequestDiff, GitHubReadError>;
  post(
    input: PullRequestTarget & {
      readonly commitId: string;
      readonly body: string;
      readonly comments: readonly Omit<InlineReviewComment, 'id'>[];
    },
  ): Effect.Effect<PostedReview, PullRequestReviewFailedError>;
}

export const PullRequestReviewer = Context.Service<
  '@porcelain/reviews/PullRequestReviewer',
  PullRequestReviewer
>('@porcelain/reviews/PullRequestReviewer');
