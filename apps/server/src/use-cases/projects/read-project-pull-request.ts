import { Context, Effect, Layer } from 'effect';
import type {
  ProjectPullRequestParams,
  ReadPullRequestResponse,
} from '@porcelain/contracts/projects';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import { ReadGitHubPullRequestService } from '@porcelain/reviews/services';
import { ReadProjectGitHubTargetUseCasePort } from '../../ports/read-project-github-target-use-case-port.ts';
import { mapPullRequest } from '@porcelain/reviews/rules';
export class ReadProjectPullRequestUseCase extends Context.Service<
  ReadProjectPullRequestUseCase,
  {
    readonly execute: (
      input: ProjectPullRequestParams,
    ) => Effect.Effect<ReadPullRequestResponse, ProjectNotFoundError>;
  }
>()('@porcelain/server/ReadProjectPullRequestUseCase') {
  static readonly layer = Layer.effect(
    ReadProjectPullRequestUseCase,
    Effect.gen(function* () {
      const target = yield* ReadProjectGitHubTargetUseCasePort;
      const github = yield* ReadGitHubPullRequestService;
      return {
        execute: Effect.fn('ReadProjectPullRequestUseCase.execute')(
          function* (input) {
            const linked = yield* target.execute(input);
            if (linked.kind !== 'available') return linked;
            const result = yield* github
              .execute({
                ...linked.repository,
                account: linked.account,
                number: linked.number,
              })
              .pipe(Effect.result);
            if (result._tag === 'Failure')
              return {
                kind: 'unavailable',
                reason:
                  result.failure._tag === 'GitHubPullRequestNotFoundError'
                    ? 'pull-request-not-found'
                    : result.failure.reason,
              };
            return {
              kind: 'available',
              account: linked.account,
              pullRequest: mapPullRequest(result.success),
            };
          },
        ),
      };
    }),
  );
}
