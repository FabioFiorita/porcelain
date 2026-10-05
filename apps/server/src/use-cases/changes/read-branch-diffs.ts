import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { type GitIoFailure } from '@porcelain/git/errors';
import {
  type CommitNotFoundError,
  type IncompleteDiffReadError,
} from '@porcelain/changes/errors';
import { ReadBranchDiffsService } from '@porcelain/changes/services';
import {
  type ReadBranchDiffsRequest,
  type ReadBranchDiffsResponse,
} from '@porcelain/contracts/changes';
import { type WorktreeParams } from '@porcelain/contracts/shared';

export class ReadBranchDiffsUseCase extends Context.Service<
  ReadBranchDiffsUseCase,
  {
    readonly execute: (
      input: WorktreeParams & ReadBranchDiffsRequest,
    ) => Effect.Effect<
      ReadBranchDiffsResponse,
      | WorktreeAccessFailure
      | GitIoFailure
      | CommitNotFoundError
      | IncompleteDiffReadError
    >;
  }
>()('@porcelain/server/ReadBranchDiffsUseCase') {
  static readonly layer = Layer.effect(
    ReadBranchDiffsUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const readBranchDiffsCapability = yield* ReadBranchDiffsService;

      return {
        execute: Effect.fn('ReadBranchDiffsUseCase.execute')(function* (
          input: WorktreeParams & ReadBranchDiffsRequest,
        ): Effect.fn.Return<
          ReadBranchDiffsResponse,
          | WorktreeAccessFailure
          | GitIoFailure
          | CommitNotFoundError
          | IncompleteDiffReadError
        > {
          return yield* Effect.suspend(() => {
            const { worktreeId, baseOid, headOid, paths } = input;
            return accessCapability.read(worktreeId, () =>
              Effect.gen(function* () {
                const diffs = yield* readBranchDiffsCapability.execute({
                  worktreeId,
                  baseOid,
                  headOid,
                  paths,
                });
                return diffs;
              }),
            );
          });
        }),
      };
    }),
  );
}
