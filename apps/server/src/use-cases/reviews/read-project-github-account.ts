import { Context, Effect, Layer } from 'effect';
import type {
  ProjectParams,
  ProjectGitHubAccountOverride,
  GitHubAccountResponse,
} from '@porcelain/contracts/projects';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import { ResolveProjectGitHubUseCasePort } from '../../ports/resolve-project-github-use-case-port.ts';
export class ReadProjectGitHubAccountUseCase extends Context.Service<
  ReadProjectGitHubAccountUseCase,
  {
    readonly execute: (
      input: ProjectParams & ProjectGitHubAccountOverride,
    ) => Effect.Effect<GitHubAccountResponse, ProjectNotFoundError>;
  }
>()('@porcelain/server/ReadProjectGitHubAccountUseCase') {
  static readonly layer = Layer.effect(
    ReadProjectGitHubAccountUseCase,
    Effect.gen(function* () {
      const resolve = yield* ResolveProjectGitHubUseCasePort;
      return {
        execute: Effect.fn('ReadProjectGitHubAccountUseCase.execute')(
          function* (input) {
            return (yield* resolve.execute(input)).selection;
          },
        ),
      };
    }),
  );
}
