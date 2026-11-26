import { Context, Effect, Layer } from 'effect';
import type {
  ProjectPullRequestParams,
  RerunPullChecksRequest,
  RerunPullChecksResponse,
} from '@porcelain/contracts/projects';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import type { PullRequestActionRefusedError } from '@porcelain/reviews/errors';
import { RerunGitHubChecksService } from '@porcelain/reviews/services';
import { ReadProjectGitHubTargetUseCasePort } from '../../ports/read-project-github-target-use-case-port.ts';
export class RerunPullRequestChecksUseCase extends Context.Service<
  RerunPullRequestChecksUseCase,
  {
    readonly execute: (
      input: ProjectPullRequestParams & RerunPullChecksRequest,
    ) => Effect.Effect<
      RerunPullChecksResponse,
      ProjectNotFoundError | PullRequestActionRefusedError
    >;
  }
>()('@porcelain/server/RerunPullRequestChecksUseCase') {
  static readonly layer = Layer.effect(
    RerunPullRequestChecksUseCase,
    Effect.gen(function* () {
      const targets = yield* ReadProjectGitHubTargetUseCasePort;
      const rerun = yield* RerunGitHubChecksService;
      return {
        execute: Effect.fn('RerunPullRequestChecksUseCase.execute')(
          function* (input) {
            yield* rerun.execute({
              target: yield* targets.execute(input),
              headSha: input.headSha,
              rerun: input.target,
            });
            return { requested: true as const };
          },
        ),
      };
    }),
  );
}
