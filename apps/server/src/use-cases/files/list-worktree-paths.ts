import { type ListWorktreePathsResponse } from '@porcelain/contracts/files';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import { ListWorktreePathsService } from '@porcelain/files/services';
import { type DirectoryTooLargeError } from '@porcelain/files/errors';
import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';

export class ListWorktreePathsUseCase extends Context.Service<
  ListWorktreePathsUseCase,
  {
    readonly execute: (
      input: WorktreeParams,
    ) => Effect.Effect<
      ListWorktreePathsResponse,
      WorktreeAccessFailure | DirectoryTooLargeError
    >;
  }
>()('@porcelain/server/ListWorktreePathsUseCase') {
  static readonly layer = Layer.effect(
    ListWorktreePathsUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const listWorktreePathsCapability = yield* ListWorktreePathsService;

      return {
        execute: Effect.fn('ListWorktreePathsUseCase.execute')(function* (
          input: WorktreeParams,
        ): Effect.fn.Return<
          ListWorktreePathsResponse,
          WorktreeAccessFailure | DirectoryTooLargeError
        > {
          return yield* accessCapability.read(input.worktreeId, (worktree) =>
            listWorktreePathsCapability.execute({
              ...input,
              worktreeId: worktree.id,
            }),
          );
        }),
      };
    }),
  );
}
