import { Context, type Effect } from 'effect';
import type {
  GitHubRepository,
  PullRequestMergeMethod,
} from '../models/pull-request.ts';
import type { PullRequestMergeRefusedError } from '../errors/pull-request-merge-refused-error.ts';
export interface GitHubPullRequestMerger {
  merge(
    input: GitHubRepository & {
      account: string;
      number: number;
      method: PullRequestMergeMethod;
      headSha: string;
    },
  ): Effect.Effect<void, PullRequestMergeRefusedError>;
}
export const GitHubPullRequestMerger = Context.Service<
  '@porcelain/reviews/GitHubPullRequestMerger',
  GitHubPullRequestMerger
>('@porcelain/reviews/GitHubPullRequestMerger');
