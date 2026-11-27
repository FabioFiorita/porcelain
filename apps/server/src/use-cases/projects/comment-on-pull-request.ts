import { Context, Effect, Layer } from 'effect';
import type {
  CommentOnPullRequestRequest,
  CommentOnPullRequestResponse,
  ProjectPullRequestParams,
} from '@porcelain/contracts/projects';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import type { PullRequestActionRefusedError } from '@porcelain/reviews/errors';
import { CommentOnGitHubPullRequestService } from '@porcelain/reviews/services';
import { ReadProjectGitHubTargetUseCasePort } from '../../ports/read-project-github-target-use-case-port.ts';
export class CommentOnPullRequestUseCase extends Context.Service<
  CommentOnPullRequestUseCase,
  {
    readonly execute: (
      input: ProjectPullRequestParams & CommentOnPullRequestRequest,
    ) => Effect.Effect<
      CommentOnPullRequestResponse,
      ProjectNotFoundError | PullRequestActionRefusedError
    >;
  }
>()('@porcelain/server/CommentOnPullRequestUseCase') {
  static readonly layer = Layer.effect(
    CommentOnPullRequestUseCase,
    Effect.gen(function* () {
      const targets = yield* ReadProjectGitHubTargetUseCasePort;
      const comment = yield* CommentOnGitHubPullRequestService;
      return {
        execute: Effect.fn('CommentOnPullRequestUseCase.execute')(
          function* (input) {
            return yield* comment.execute({
              target: yield* targets.execute(input),
              body: input.body,
            });
          },
        ),
      };
    }),
  );
}
