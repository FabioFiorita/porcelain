import { Context, Effect, Layer } from 'effect';
import type {
  ProjectPullJobParams,
  ReadCheckLogQuery,
  ReadCheckLogResponse,
} from '@porcelain/contracts/projects';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import { ReadGitHubCheckLogService } from '@porcelain/reviews/services';
import { ReadProjectGitHubTargetUseCasePort } from '../../ports/read-project-github-target-use-case-port.ts';

export class ReadProjectCheckLogUseCase extends Context.Service<
  ReadProjectCheckLogUseCase,
  {
    readonly execute: (
      input: ProjectPullJobParams & ReadCheckLogQuery,
    ) => Effect.Effect<ReadCheckLogResponse, ProjectNotFoundError>;
  }
>()('@porcelain/server/ReadProjectCheckLogUseCase') {
  static readonly layer = Layer.effect(
    ReadProjectCheckLogUseCase,
    Effect.gen(function* () {
      const targets = yield* ReadProjectGitHubTargetUseCasePort;
      const logs = yield* ReadGitHubCheckLogService;
      return {
        execute: Effect.fn('ReadProjectCheckLogUseCase.execute')(
          function* (input) {
            const target = yield* targets.execute(input);
            if (target.kind !== 'available') return target;
            return yield* logs
              .execute({
                ...target.repository,
                account: target.account,
                jobId: input.jobId,
                from: input.from,
                to: input.to,
              })
              .pipe(
                Effect.catch((error) =>
                  Effect.succeed({
                    kind: 'unavailable' as const,
                    reason: error.reason,
                  }),
                ),
              );
          },
        ),
      };
    }),
  );
}
