import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { type GitIoFailure } from '@porcelain/git/errors';
import { ListCommitsService } from '@porcelain/changes/services';
import {
  type ListCommitsQuery,
  type ListCommitsResponse,
} from '@porcelain/contracts/changes';
import { type WorktreeParams } from '@porcelain/contracts/shared';

export class ListCommitsUseCase extends Context.Service<
  ListCommitsUseCase,
  {
    readonly execute: (
      input: WorktreeParams & ListCommitsQuery,
    ) => Effect.Effect<
      ListCommitsResponse,
      WorktreeAccessFailure | GitIoFailure
    >;
  }
>()('@porcelain/server/ListCommitsUseCase') {
  static readonly layer = Layer.effect(
    ListCommitsUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const listCommitsCapability = yield* ListCommitsService;

      return {
        execute: Effect.fn('ListCommitsUseCase.execute')(function* (
          input: WorktreeParams & ListCommitsQuery,
        ): Effect.fn.Return<
          ListCommitsResponse,
          WorktreeAccessFailure | GitIoFailure
        > {
          return yield* Effect.suspend(() => {
            const { worktreeId, limit, after, tip } = input;
            return accessCapability.read(worktreeId, () =>
              Effect.gen(function* () {
                const page = yield* listCommitsCapability.execute({
                  worktreeId,
                  limit,
                  after,
                  tip,
                });
                return page;
              }),
            );
          });
        }),
      };
    }),
  );
}
