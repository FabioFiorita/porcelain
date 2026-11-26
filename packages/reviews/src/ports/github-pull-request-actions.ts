import { Context, type Effect } from 'effect';
import type {
  GitHubRepository,
  PullRequestRerunTarget,
} from '../models/pull-request.ts';
import type { PullRequestActionRefusedError } from '../errors/pull-request-action-refused-error.ts';
export interface GitHubPullRequestActions {
  rerun(
    input: GitHubRepository & {
      account: string;
      target: PullRequestRerunTarget;
    },
  ): Effect.Effect<void, PullRequestActionRefusedError>;
  comment(
    input: GitHubRepository & { account: string; number: number; body: string },
  ): Effect.Effect<{ url: string }, PullRequestActionRefusedError>;
}
export const GitHubPullRequestActions = Context.Service<
  '@porcelain/reviews/GitHubPullRequestActions',
  GitHubPullRequestActions
>('@porcelain/reviews/GitHubPullRequestActions');
