import { Context, Effect, Layer } from 'effect';
import type {
  GitHubRepository,
  PullChecksResult,
} from '../models/pull-request.ts';
import type { GitHubReadError } from '../errors/github-read-error.ts';
import type { GitHubPullRequestNotFoundError } from '../errors/github-pull-request-not-found-error.ts';
import { GitHubReader } from '../ports/github-reader.ts';
export class ReadGitHubPullChecksService extends Context.Service<
  ReadGitHubPullChecksService,
  {
    readonly execute: (
      input: GitHubRepository & { account: string; number: number },
    ) => Effect.Effect<
      { number: number; checks: PullChecksResult },
      GitHubReadError | GitHubPullRequestNotFoundError
    >;
  }
>()('@porcelain/reviews/ReadGitHubPullChecksService') {
  static readonly layer = Layer.effect(
    ReadGitHubPullChecksService,
    Effect.gen(function* () {
      const github = yield* GitHubReader;
      return {
        execute: Effect.fn('ReadGitHubPullChecksService.execute')(
          function* (input) {
            const result = yield* github.checks(input);
            const state =
              result.commits.nodes[0]?.commit.statusCheckRollup?.state;
            let checks: PullChecksResult = 'none';
            if (state === 'SUCCESS') checks = 'passed';
            if (state === 'PENDING' || state === 'EXPECTED') checks = 'running';
            if (state === 'FAILURE' || state === 'ERROR') checks = 'failed';
            return { number: result.number, checks };
          },
        ),
      };
    }),
  );
}
