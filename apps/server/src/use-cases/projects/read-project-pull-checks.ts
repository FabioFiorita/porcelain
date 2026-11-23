import { readProjectPull } from '../../runtime/read-project-pull.ts';
import { Context, Effect, Layer } from 'effect';
import type {
  ProjectPullRequestParams,
  ReadPullChecksResponse,
} from '@porcelain/contracts/projects';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import { ReadGitHubPullChecksService } from '@porcelain/reviews/services';
import { ReadProjectGitHubTargetUseCasePort } from '../../ports/read-project-github-target-use-case-port.ts';

export class ReadProjectPullChecksUseCase extends Context.Service<
  ReadProjectPullChecksUseCase,
  {
    readonly execute: (
      input: ProjectPullRequestParams,
    ) => Effect.Effect<ReadPullChecksResponse, ProjectNotFoundError>;
  }
>()('@porcelain/server/ReadProjectPullChecksUseCase') {
  static readonly layer = Layer.effect(
    ReadProjectPullChecksUseCase,
    Effect.gen(function* () {
      const target = yield* ReadProjectGitHubTargetUseCasePort;
      const github = yield* ReadGitHubPullChecksService;
      return {
        execute: Effect.fn('ReadProjectPullChecksUseCase.execute')(
          function* (input) {
            const pulled = yield* readProjectPull(
              target,
              input,
              github.execute,
            );
            if (pulled.kind !== 'available') return pulled;
            return { kind: 'available', ...pulled.result };
          },
        ),
      };
    }),
  );
}
