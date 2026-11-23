import { readProjectPull } from '../../runtime/read-project-pull.ts';
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
            const pulled = yield* readProjectPull(
              target,
              input,
              github.execute,
            );
            if (pulled.kind !== 'available') return pulled;
            return {
              kind: 'available',
              account: pulled.account,
              pullRequest: mapPullRequest(pulled.result),
            };
          },
        ),
      };
    }),
  );
}
