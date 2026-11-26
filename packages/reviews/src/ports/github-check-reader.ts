import { Context, type Effect } from 'effect';
import type {
  GitHubPullStatus,
  GitHubRepository,
} from '../models/pull-request.ts';
import type { GitHubReadError } from '../errors/github-read-error.ts';
import type { GitHubPullRequestNotFoundError } from '../errors/github-pull-request-not-found-error.ts';
export interface GitHubCheckReader {
  status(
    input: GitHubRepository & { account: string; number: number },
  ): Effect.Effect<
    GitHubPullStatus,
    GitHubReadError | GitHubPullRequestNotFoundError
  >;
  jobLog(
    input: GitHubRepository & { account: string; jobId: number },
  ): Effect.Effect<
    | { readonly kind: 'log'; readonly text: string }
    | { readonly kind: 'log-missing' | 'log-too-large' },
    GitHubReadError
  >;
}
export const GitHubCheckReader = Context.Service<
  '@porcelain/reviews/GitHubCheckReader',
  GitHubCheckReader
>('@porcelain/reviews/GitHubCheckReader');
