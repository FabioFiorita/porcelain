import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { type GitIoFailure } from '@porcelain/git/errors';
import { ListFileCommitsService } from '@porcelain/changes/services';
import {
  type ListFileCommitsQuery,
  type ListFileCommitsResponse,
} from '@porcelain/contracts/changes';
import { type WorktreeParams } from '@porcelain/contracts/shared';

export class ListFileCommitsUseCase extends Context.Service<
  ListFileCommitsUseCase,
  {
    readonly execute: (
      input: WorktreeParams & ListFileCommitsQuery,
    ) => Effect.Effect<
      ListFileCommitsResponse,
      WorktreeAccessFailure | GitIoFailure
    >;
  }
>()('@porcelain/server/ListFileCommitsUseCase') {
  static readonly layer = Layer.effect(
    ListFileCommitsUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const listFileCommitsCapability = yield* ListFileCommitsService;

      return {
        execute: Effect.fn('ListFileCommitsUseCase.execute')(function* (
          input: WorktreeParams & ListFileCommitsQuery,
        ): Effect.fn.Return<
          ListFileCommitsResponse,
          WorktreeAccessFailure | GitIoFailure
        > {
          return yield* Effect.suspend(() => {
            const { worktreeId, path, limit } = input;
            return accessCapability.read(worktreeId, () =>
              Effect.gen(function* () {
                const listed = yield* listFileCommitsCapability.execute({
                  worktreeId,
                  path,
                  limit,
                });
                return listed;
              }),
            );
          });
        }),
      };
    }),
  );
}
