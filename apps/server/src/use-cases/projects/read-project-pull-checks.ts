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
            return { kind: 'available', ...result.success };
          },
        ),
      };
    }),
  );
}
