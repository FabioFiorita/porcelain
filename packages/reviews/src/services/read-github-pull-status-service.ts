import { Context, Effect, Layer } from 'effect';
import type {
  GitHubRepository,
  PullRequestStatus,
} from '../models/pull-request.ts';
import type { GitHubReadError } from '../errors/github-read-error.ts';
import type { GitHubPullRequestNotFoundError } from '../errors/github-pull-request-not-found-error.ts';
import { GitHubCheckReader } from '../ports/github-check-reader.ts';
import { mapPullStatus } from '../rules/pull-request-status.ts';
export class ReadGitHubPullStatusService extends Context.Service<
  ReadGitHubPullStatusService,
  {
    readonly execute: (
      input: GitHubRepository & { account: string; number: number },
    ) => Effect.Effect<
      PullRequestStatus,
      GitHubReadError | GitHubPullRequestNotFoundError
    >;
  }
>()('@porcelain/reviews/ReadGitHubPullStatusService') {
  static readonly layer = Layer.effect(
    ReadGitHubPullStatusService,
    Effect.gen(function* () {
      const github = yield* GitHubCheckReader;
      return {
        execute: Effect.fn('ReadGitHubPullStatusService.execute')(
          function* (input) {
            return mapPullStatus(yield* github.status(input));
          },
        ),
      };
    }),
  );
}
