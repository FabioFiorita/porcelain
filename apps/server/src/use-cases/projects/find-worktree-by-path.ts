import { InventoryRefresh } from '../../ports/inventory-refresh.ts';
import { Effect, Context, Layer } from 'effect';
import {
  type NoWorktreeAtPathError,
  type ProjectNotFoundError,
} from '@porcelain/projects/errors';
import {
  type FindWorktreeByPathRequest,
  type FindWorktreeByPathResponse,
} from '@porcelain/contracts/projects';
import { type ProjectWorktrees } from '@porcelain/projects/models';
import {
  FindWorktreeAtPathService,
  ListKnownWorktreesService,
  ListRegisteredProjectsService,
} from '@porcelain/projects/services';
import { worktreeAtPath } from '@porcelain/projects/rules';

import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class FindWorktreeByPathUseCase extends Context.Service<
  FindWorktreeByPathUseCase,
  {
    readonly execute: (
      input: FindWorktreeByPathRequest,
    ) => Effect.Effect<
      FindWorktreeByPathResponse,
      NoWorktreeAtPathError | ProjectNotFoundError
    >;
  }
>()('@porcelain/server/FindWorktreeByPathUseCase') {
  static readonly layer = Layer.effect(
    FindWorktreeByPathUseCase,
    Effect.gen(function* () {
      const listRegisteredProjectsCapability =
        yield* ListRegisteredProjectsService;
      const listKnownWorktreesCapability = yield* ListKnownWorktreesService;
      const findWorktreeAtPathCapability = yield* FindWorktreeAtPathService;
      const refreshInventoryCapability = yield* InventoryRefresh;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;
      const operationListings = Effect.fn('FindWorktreeByPathUseCase.listings')(
        function* (): Effect.fn.Return<ProjectWorktrees[]> {
          return yield* lanesCapability.run(
            laneKeysCapability.inventory(),
            'read',
            () =>
              Effect.gen(function* () {
                const inventory =
                  yield* listRegisteredProjectsCapability.execute();
                return (yield* listKnownWorktreesCapability.execute(inventory))
                  .listings;
              }),
          );
        },
      );
      return {
        execute: Effect.fn('FindWorktreeByPathUseCase.execute')(function* (
          input: FindWorktreeByPathRequest,
        ): Effect.fn.Return<
          FindWorktreeByPathResponse,
          NoWorktreeAtPathError | ProjectNotFoundError
        > {
          const known = yield* operationListings();
          const worktreeId = worktreeAtPath(input.path, known);
          if (worktreeId !== undefined) return { worktreeId };
          yield* refreshInventoryCapability.execute();
          return yield* findWorktreeAtPathCapability.execute({
            path: input.path,
            listings: yield* operationListings(),
          });
        }),
      };
    }),
  );
}
