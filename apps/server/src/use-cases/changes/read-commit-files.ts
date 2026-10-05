import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { type GitIoFailure } from '@porcelain/git/errors';
import { type CommitNotFoundError } from '@porcelain/changes/errors';
import { ReadCommitFilesService } from '@porcelain/changes/services';
import {
  type ReadCommitFilesParams,
  type ReadCommitFilesQuery,
  type ReadCommitFilesResponse,
} from '@porcelain/contracts/changes';

export class ReadCommitFilesUseCase extends Context.Service<
  ReadCommitFilesUseCase,
  {
    readonly execute: (
      input: ReadCommitFilesParams & ReadCommitFilesQuery,
    ) => Effect.Effect<
      ReadCommitFilesResponse,
      WorktreeAccessFailure | GitIoFailure | CommitNotFoundError
    >;
  }
>()('@porcelain/server/ReadCommitFilesUseCase') {
  static readonly layer = Layer.effect(
    ReadCommitFilesUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const readCommitFilesCapability = yield* ReadCommitFilesService;

      return {
        execute: Effect.fn('ReadCommitFilesUseCase.execute')(function* (
          input: ReadCommitFilesParams & ReadCommitFilesQuery,
        ): Effect.fn.Return<
          ReadCommitFilesResponse,
          WorktreeAccessFailure | GitIoFailure | CommitNotFoundError
        > {
          return yield* Effect.suspend(() => {
            const { worktreeId, oid, parent } = input;
            return accessCapability.read(worktreeId, () =>
              Effect.gen(function* () {
                const files = yield* readCommitFilesCapability.execute({
                  worktreeId,
                  oid,
                  parent,
                });
                return files;
              }),
            );
          });
        }),
      };
    }),
  );
}
