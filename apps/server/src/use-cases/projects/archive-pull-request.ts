import { Context, Effect, Layer } from 'effect';
import type {
  ProjectPullRequestParams,
  ArchivePullRequestRequest,
  ArchivePullRequestResponse,
} from '@porcelain/contracts/projects';
import {
  ArchiveBranchService,
  CheckProjectService,
  ListKnownWorktreesService,
} from '@porcelain/projects/services';
import type { BranchArchiveRefusedError } from '@porcelain/projects/errors';
import { type ProjectNotFoundError } from '@porcelain/projects/errors';
import { ReadProjectPullRequestUseCasePort } from '../../ports/read-project-pull-request-use-case-port.ts';
import { InventoryScan } from '../../ports/inventory-scan.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
export class ArchivePullRequestUseCase extends Context.Service<
  ArchivePullRequestUseCase,
  {
    readonly execute: (
      input: ProjectPullRequestParams & ArchivePullRequestRequest,
    ) => Effect.Effect<
      ArchivePullRequestResponse,
      ProjectNotFoundError | BranchArchiveRefusedError
    >;
  }
>()('@porcelain/server/ArchivePullRequestUseCase') {
  static readonly layer = Layer.effect(
    ArchivePullRequestUseCase,
    Effect.gen(function* () {
      const pulls = yield* ReadProjectPullRequestUseCasePort;
      const projects = yield* CheckProjectService;
      const worktrees = yield* ListKnownWorktreesService;
      const archive = yield* ArchiveBranchService;
      const inventory = yield* InventoryScan;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      return {
        execute: Effect.fn('ArchivePullRequestUseCase.execute')(
          function* (input) {
            const response = yield* pulls.execute(input);
            const project = yield* lanes.run(keys.inventory(), 'read', () =>
              projects.execute({ projectId: input.projectId }),
            );
            const result = yield* lanes.run(
              keys.project(project),
              'write',
              () =>
                Effect.gen(function* () {
                  const current = project;
                  const known = yield* worktrees.execute({
                    projects: [current],
                  });
                  return yield* archive.execute({
                    ...input,
                    commonDirectory: current.commonDirectory,
                    repositoryIdentity: current.repositoryIdentity,
                    pull:
                      response.kind === 'available'
                        ? response.pullRequest
                        : undefined,
                    worktrees: known.listings[0]?.worktrees ?? [],
                  });
                }),
            );
            if (result.archived) {
              yield* inventory.execute();
            }
            return result;
          },
        ),
      };
    }),
  );
}
