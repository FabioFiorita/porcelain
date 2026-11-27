import { Context, Effect, Layer } from 'effect';
import type {
  MergePullRequestRequest,
  MergePullRequestResponse,
  ProjectPullRequestParams,
} from '@porcelain/contracts/projects';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import type { PullRequestMergeRefusedError } from '@porcelain/reviews/errors';
import { MergeGitHubPullRequestService } from '@porcelain/reviews/services';
import { ReadProjectGitHubTargetUseCasePort } from '../../ports/read-project-github-target-use-case-port.ts';
export class MergePullRequestUseCase extends Context.Service<
  MergePullRequestUseCase,
  {
    readonly execute: (
      input: ProjectPullRequestParams & MergePullRequestRequest,
    ) => Effect.Effect<
      MergePullRequestResponse,
      ProjectNotFoundError | PullRequestMergeRefusedError
    >;
  }
>()('@porcelain/server/MergePullRequestUseCase') {
  static readonly layer = Layer.effect(
    MergePullRequestUseCase,
    Effect.gen(function* () {
      const targets = yield* ReadProjectGitHubTargetUseCasePort;
      const merge = yield* MergeGitHubPullRequestService;
      return {
        execute: Effect.fn('MergePullRequestUseCase.execute')(
          function* (input) {
            yield* merge.execute({
              target: yield* targets.execute(input),
              method: input.method,
              headSha: input.headSha,
            });
            return { merged: true as const };
          },
        ),
      };
    }),
  );
}
