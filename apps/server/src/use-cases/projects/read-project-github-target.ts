import { Context, Effect, Layer } from 'effect';
import type { ProjectPullRequestParams } from '@porcelain/contracts/projects';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import type { ProjectGitHubTarget } from '../../ports/read-project-github-target-use-case-port.ts';
import { ResolveProjectGitHubUseCasePort } from '../../ports/resolve-project-github-use-case-port.ts';
export class ReadProjectGitHubTargetUseCase extends Context.Service<
  ReadProjectGitHubTargetUseCase,
  {
    readonly execute: (
      input: ProjectPullRequestParams,
    ) => Effect.Effect<ProjectGitHubTarget, ProjectNotFoundError>;
  }
>()('@porcelain/server/ReadProjectGitHubTargetUseCase') {
  static readonly layer = Layer.effect(
    ReadProjectGitHubTargetUseCase,
    Effect.gen(function* () {
      const resolve = yield* ResolveProjectGitHubUseCasePort;
      return {
        execute: Effect.fn('ReadProjectGitHubTargetUseCase.execute')(
          function* (input) {
            const { repository, selection } = yield* resolve.execute({
              projectId: input.projectId,
            });
            if (selection.unavailable) return selection.unavailable;
            if (!repository || !selection.choice)
              return { kind: 'unavailable', reason: 'not-github' };
            return {
              kind: 'available',
              repository,
              account: selection.choice.account,
              number: input.number,
            };
          },
        ),
      };
    }),
  );
}
