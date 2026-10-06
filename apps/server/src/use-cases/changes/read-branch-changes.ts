import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { type GitIoFailure } from '@porcelain/git/errors';
import {
  type BranchBaseNotFoundError,
  type UnbornBranchError,
  type UnrelatedBranchError,
} from '@porcelain/changes/errors';
import { ReadBranchChangesService } from '@porcelain/changes/services';
import {
  type ReadBranchChangesQuery,
  type ReadBranchChangesResponse,
} from '@porcelain/contracts/changes';
import { type WorktreeParams } from '@porcelain/contracts/shared';

export class ReadBranchChangesUseCase extends Context.Service<
  ReadBranchChangesUseCase,
  {
    readonly execute: (
      input: WorktreeParams & ReadBranchChangesQuery,
    ) => Effect.Effect<
      ReadBranchChangesResponse,
      | WorktreeAccessFailure
      | GitIoFailure
      | BranchBaseNotFoundError
      | UnbornBranchError
      | UnrelatedBranchError
    >;
  }
>()('@porcelain/server/ReadBranchChangesUseCase') {
  static readonly layer = Layer.effect(
    ReadBranchChangesUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const readBranchChangesCapability = yield* ReadBranchChangesService;

      return {
        execute: Effect.fn('ReadBranchChangesUseCase.execute')(function* (
          input: WorktreeParams & ReadBranchChangesQuery,
        ): Effect.fn.Return<
          ReadBranchChangesResponse,
          | WorktreeAccessFailure
          | GitIoFailure
          | BranchBaseNotFoundError
          | UnbornBranchError
          | UnrelatedBranchError
        > {
          return yield* Effect.suspend(() => {
            const { worktreeId, base } = input;
            return accessCapability.read(worktreeId, () =>
              Effect.gen(function* () {
                const changes = yield* readBranchChangesCapability.execute({
                  worktreeId,
                  base,
                });
                return { worktreeId, ...changes };
              }),
            );
          });
        }),
      };
    }),
  );
}
