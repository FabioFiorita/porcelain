import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { type GitIoFailure } from '@porcelain/git/errors';
import { type CommitNotFoundError } from '@porcelain/changes/errors';
import {
  CheckCommitService,
  ReadCommitDiffsService,
} from '@porcelain/changes/services';
import {
  type ReadCommitDiffsParams,
  type ReadCommitDiffsRequest,
  type ReadCommitDiffsResponse,
} from '@porcelain/contracts/changes';

export class ReadCommitDiffsUseCase extends Context.Service<
  ReadCommitDiffsUseCase,
  {
    readonly execute: (
      input: ReadCommitDiffsParams & ReadCommitDiffsRequest,
    ) => Effect.Effect<
      ReadCommitDiffsResponse,
      WorktreeAccessFailure | GitIoFailure | CommitNotFoundError
    >;
  }
>()('@porcelain/server/ReadCommitDiffsUseCase') {
  static readonly layer = Layer.effect(
    ReadCommitDiffsUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const checkCommitCapability = yield* CheckCommitService;
      const readCommitDiffsCapability = yield* ReadCommitDiffsService;

      return {
        execute: Effect.fn('ReadCommitDiffsUseCase.execute')(function* (
          input: ReadCommitDiffsParams & ReadCommitDiffsRequest,
        ): Effect.fn.Return<
          ReadCommitDiffsResponse,
          WorktreeAccessFailure | GitIoFailure | CommitNotFoundError
        > {
          return yield* Effect.suspend(() => {
            const { worktreeId, oid, parent, paths } = input;
            return accessCapability.read(worktreeId, () =>
              Effect.gen(function* () {
                yield* checkCommitCapability.execute({
                  worktreeId,
                  oid,
                  parent,
                });
                const diffs = yield* readCommitDiffsCapability.execute({
                  worktreeId,
                  oid,
                  parent,
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
