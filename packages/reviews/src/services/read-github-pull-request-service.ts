import { Context, Effect, Layer } from 'effect';
import type {
  GitHubPullRequest,
  GitHubRepository,
} from '../models/pull-request.ts';
import type { GitHubReadError } from '../errors/github-read-error.ts';
import type { GitHubPullRequestNotFoundError } from '../errors/github-pull-request-not-found-error.ts';
import { GitHubReader } from '../ports/github-reader.ts';
export class ReadGitHubPullRequestService extends Context.Service<
  ReadGitHubPullRequestService,
  {
    readonly execute: (
      input: GitHubRepository & { account: string; number: number },
    ) => Effect.Effect<
      GitHubPullRequest,
      GitHubReadError | GitHubPullRequestNotFoundError
    >;
  }
>()('@porcelain/reviews/ReadGitHubPullRequestService') {
  static readonly layer = Layer.effect(
    ReadGitHubPullRequestService,
    Effect.gen(function* () {
      const github = yield* GitHubReader;
      return {
        execute: Effect.fn('ReadGitHubPullRequestService.execute')((input) =>
          github.read(input),
        ),
      };
    }),
  );
}
