import type { GitHubReadError } from '../errors/github-read-error.ts';
import type { GitHubPullRequestNotFoundError } from '../errors/github-pull-request-not-found-error.ts';
import { Context, type Effect } from 'effect';
import type {
  GitHubPullRequest,
  GitHubPullSummary,
  GitHubRepository,
} from '../models/pull-request.ts';
export interface GitHubReader {
  accounts(): Effect.Effect<readonly string[], GitHubReadError>;
  canRead(
    input: GitHubRepository & { account: string },
  ): Effect.Effect<boolean, GitHubReadError>;
  read(
    input: GitHubRepository & { account: string; number: number },
  ): Effect.Effect<
    GitHubPullRequest,
    GitHubReadError | GitHubPullRequestNotFoundError
  >;
  list(input: GitHubRepository & { account: string }): Effect.Effect<
    {
      open: readonly GitHubPullSummary[];
      recent: readonly GitHubPullSummary[];
      truncated: boolean;
    },
    GitHubReadError
  >;
}
export const GitHubReader = Context.Service<
  '@porcelain/reviews/GitHubReader',
  GitHubReader
>('@porcelain/reviews/GitHubReader');
