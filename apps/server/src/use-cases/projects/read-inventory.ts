import { ReadProjectWalkthroughsService } from '@porcelain/walkthroughs/services';
import { type MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import { Context, Effect, Layer } from 'effect';
import {
  ReadEnvironmentLabelService,
  ReadEnvironmentService,
} from '@porcelain/access/services';
import { type ReadInventoryResponse } from '@porcelain/contracts/projects';
import {
  ListKnownWorktreesService,
  ListRegisteredProjectsService,
} from '@porcelain/projects/services';
import { inventoryReport } from '@porcelain/projects/rules';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class ReadInventoryUseCase extends Context.Service<
  ReadInventoryUseCase,
  {
    readonly execute: () => Effect.Effect<
      ReadInventoryResponse,
      MissingEnvironmentIdentityError
    >;
  }
>()('@porcelain/server/ReadInventoryUseCase') {
  static readonly layer = Layer.effect(
    ReadInventoryUseCase,
    Effect.gen(function* () {
      const walkthroughs = yield* ReadProjectWalkthroughsService;
      const listRegisteredProjectsCapability =
        yield* ListRegisteredProjectsService;
      const listKnownWorktreesCapability = yield* ListKnownWorktreesService;
      const readEnvironmentCapability = yield* ReadEnvironmentService;
      const readEnvironmentLabelCapability = yield* ReadEnvironmentLabelService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('ReadInventoryUseCase.execute')(
          function* (): Effect.fn.Return<
            ReadInventoryResponse,
            MissingEnvironmentIdentityError
          > {
            const { inventory, listings } = yield* lanesCapability.run(
              laneKeysCapability.inventory(),
              'read',
              () =>
                Effect.gen(function* () {
                  const inventory =
                    yield* listRegisteredProjectsCapability.execute();
                  return {
                    inventory,
                    listings: (yield* listKnownWorktreesCapability.execute(
                      inventory,
                    )).listings,
                  };
                }),
            );
            const { environmentId, environment } = yield* lanesCapability.run(
              laneKeysCapability.access(),
              'read',
              () =>
                Effect.gen(function* () {
                  return {
                    environmentId: (yield* readEnvironmentCapability.execute())
                      .environmentId,
                    environment:
                      yield* readEnvironmentLabelCapability.execute(),
                  };
                }),
            );
            const report = inventoryReport(environmentId, inventory, listings);
            const projects = yield* Effect.forEach(report.projects, (project) =>
              Effect.gen(function* () {
                const metadata = yield* walkthroughs.execute({
                  projectId: project.id,
                  worktreeIds: project.worktrees.map((worktree) => worktree.id),
                });
                const walkthroughSettings = metadata.settings;
                const titles = metadata.titles;
                const worktrees = project.worktrees.map((worktree) => {
                  const run = metadata.runs.find(
                    (run) =>
                      run?.worktreeId === worktree.id &&
                      run.branch === worktree.branch &&
                      run.state.status === 'ready',
                  );
                  const title =
                    run?.state.status === 'ready' &&
                    run.branch !== undefined &&
                    run.branch === worktree.branch
                      ? run.state.content.title
                      : undefined;
                  const pull = titles.find(
                    (pull) => pull.branch === worktree.branch,
                  );
                  return {
                    ...worktree,
                    ...(title ? { walkthroughTitle: title } : {}),
                    ...(pull ? { pullRequestTitle: pull.title } : {}),
                  };
                });
                return { ...project, walkthroughSettings, worktrees };
              }),
            );
            return { ...report, projects, environment };
          },
        ),
      };
    }),
  );
}
