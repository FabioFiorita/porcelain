import { readProjectPull } from '../../runtime/read-project-pull.ts';
import { Context, Effect, Layer } from 'effect';
import type {
  ProjectPullRequestParams,
  ReadPullStatusResponse,
} from '@porcelain/contracts/projects';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import { ReadGitHubPullStatusService } from '@porcelain/reviews/services';
import { ReadProjectGitHubTargetUseCasePort } from '../../ports/read-project-github-target-use-case-port.ts';

export class ReadProjectPullStatusUseCase extends Context.Service<
  ReadProjectPullStatusUseCase,
  {
    readonly execute: (
      input: ProjectPullRequestParams,
    ) => Effect.Effect<ReadPullStatusResponse, ProjectNotFoundError>;
  }
>()('@porcelain/server/ReadProjectPullStatusUseCase') {
  static readonly layer = Layer.effect(
    ReadProjectPullStatusUseCase,
    Effect.gen(function* () {
      const target = yield* ReadProjectGitHubTargetUseCasePort;
      const github = yield* ReadGitHubPullStatusService;
      return {
        execute: Effect.fn('ReadProjectPullStatusUseCase.execute')(
          function* (input) {
            const pulled = yield* readProjectPull(
              target,
              input,
              github.execute,
            );
            if (pulled.kind !== 'available') return pulled;
            return { kind: 'available', status: pulled.result };
          },
        ),
      };
    }),
  );
}
