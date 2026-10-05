import {
  type ListDirectoryQuery,
  type ListDirectoryResponse,
} from '@porcelain/contracts/files';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import {
  ListDirectoryService,
  type ListDirectoryFailure,
} from '@porcelain/files/services';
import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';

export class ListDirectoryUseCase extends Context.Service<
  ListDirectoryUseCase,
  {
    readonly execute: (
      input: WorktreeParams & ListDirectoryQuery,
    ) => Effect.Effect<
      ListDirectoryResponse,
      WorktreeAccessFailure | ListDirectoryFailure
    >;
  }
>()('@porcelain/server/ListDirectoryUseCase') {
  static readonly layer = Layer.effect(
    ListDirectoryUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const listDirectoryCapability = yield* ListDirectoryService;

      return {
        execute: Effect.fn('ListDirectoryUseCase.execute')(function* (
          input: WorktreeParams & ListDirectoryQuery,
        ): Effect.fn.Return<
          ListDirectoryResponse,
          WorktreeAccessFailure | ListDirectoryFailure
        > {
          return yield* accessCapability.read(input.worktreeId, (worktree) =>
            listDirectoryCapability.execute({
              ...input,
              worktreeId: worktree.id,
            }),
          );
        }),
      };
    }),
  );
}
