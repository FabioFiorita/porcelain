import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { type GitIoFailure } from '@porcelain/git/errors';
import { ListBranchBasesService } from '@porcelain/changes/services';
import { type ListBranchBasesResponse } from '@porcelain/contracts/changes';
import { type WorktreeParams } from '@porcelain/contracts/shared';

export class ListBranchBasesUseCase extends Context.Service<
  ListBranchBasesUseCase,
  {
    readonly execute: (
      input: WorktreeParams,
    ) => Effect.Effect<
      ListBranchBasesResponse,
      WorktreeAccessFailure | GitIoFailure
    >;
  }
>()('@porcelain/server/ListBranchBasesUseCase') {
  static readonly layer = Layer.effect(
    ListBranchBasesUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const listBranchBasesCapability = yield* ListBranchBasesService;

      return {
        execute: Effect.fn('ListBranchBasesUseCase.execute')(function* (
          input: WorktreeParams,
        ): Effect.fn.Return<
          ListBranchBasesResponse,
          WorktreeAccessFailure | GitIoFailure
        > {
          return yield* Effect.suspend(() => {
            const { worktreeId } = input;
            return accessCapability.read(worktreeId, () =>
              Effect.gen(function* () {
                const bases = yield* listBranchBasesCapability.execute({
                  worktreeId,
                });
                return bases;
              }),
            );
          });
        }),
      };
    }),
  );
}
