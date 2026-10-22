import { EventPublisher } from '../../ports/event-publisher.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Context, Effect, Layer } from 'effect';
import {
  CheckProjectService,
  ReadRepositoryOriginService,
} from '@porcelain/projects/services';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import { SelectGitHubAccountService } from '@porcelain/reviews/services';
import { GitHubAccountPreferenceService } from '@porcelain/reviews/services';
import { githubRepository } from '@porcelain/reviews/rules';
import type {
  GitHubAccountResult,
  GitHubRepository,
} from '@porcelain/reviews/models';

export class ResolveProjectGitHubUseCase extends Context.Service<
  ResolveProjectGitHubUseCase,
  {
    readonly execute: (input: {
      projectId: string;
      override?: { account: string | undefined };
    }) => Effect.Effect<
      {
        repository: GitHubRepository | undefined;
        selection: GitHubAccountResult;
      },
      ProjectNotFoundError
    >;
  }
>()('@porcelain/server/ResolveProjectGitHubUseCase') {
  static readonly layer = Layer.effect(
    ResolveProjectGitHubUseCase,
    Effect.gen(function* () {
      const find = yield* CheckProjectService;
      const origin = yield* ReadRepositoryOriginService;
      const select = yield* SelectGitHubAccountService;
      const accounts = yield* GitHubAccountPreferenceService;
      const lanes = yield* Lanes;
      const events = yield* EventPublisher;
      const keys = yield* LaneKeys;
      return {
        execute: Effect.fn('ResolveProjectGitHubUseCase.execute')(
          function* (input) {
            const found = yield* find.execute(input);
            return yield* lanes.run(
              keys.project(found),
              'write',
              () =>
                Effect.gen(function* () {
                  const repository = githubRepository(
                    (yield* origin.execute({
                      path: found.commonDirectory,
                    })).originUrl,
                  );
                  const preference = yield* accounts.execute({
                    projectId: input.projectId,
                    repository:
                      repository === undefined
                        ? ''
                        : `${repository.owner}/${repository.repo}`.toLowerCase(),
                    ...(input.override === undefined
                      ? {}
                      : { override: input.override }),
                  });
                  const selection: GitHubAccountResult =
                    repository === undefined
                      ? {
                          accounts: [],
                          choice: undefined,
                          override: preference?.override,
                          unavailable: {
                            kind: 'unavailable',
                            reason: 'not-github',
                          },
                        }
                      : yield* select.execute({
                          ...repository,
                          projectId: input.projectId,
                        });
                  return { repository, selection };
                }),
              {
                succeeded: () =>
                  input.override !== undefined
                    ? events.inventoryChanged()
                    : Effect.void,
              },
            );
          },
        ),
      };
    }),
  );
}
