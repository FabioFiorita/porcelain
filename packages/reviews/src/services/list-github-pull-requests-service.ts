import { Context, Effect, Layer } from 'effect';
import type {
  GitHubPullSummary,
  GitHubRepository,
} from '../models/pull-request.ts';
import type { GitHubReadError } from '../errors/github-read-error.ts';
import { GitHubReader } from '../ports/github-reader.ts';
export class ListGitHubPullRequestsService extends Context.Service<
  ListGitHubPullRequestsService,
  {
    readonly execute: (
      input: GitHubRepository & { account: string },
    ) => Effect.Effect<
      {
        open: readonly GitHubPullSummary[];
        recent: readonly GitHubPullSummary[];
        truncated: boolean;
      },
      GitHubReadError
    >;
  }
>()('@porcelain/reviews/ListGitHubPullRequestsService') {
  static readonly layer = Layer.effect(
    ListGitHubPullRequestsService,
    Effect.gen(function* () {
      const github = yield* GitHubReader;
      return {
        execute: Effect.fn('ListGitHubPullRequestsService.execute')((input) =>
          github.list(input),
        ),
      };
    }),
  );
}
