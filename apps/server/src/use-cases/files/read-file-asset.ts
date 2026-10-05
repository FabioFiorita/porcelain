import {
  type ReadFileAssetQuery,
  type ReadFileAssetResponse,
} from '@porcelain/contracts/files';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import {
  ReadFileAssetService,
  type ReadFileAssetFailure,
} from '@porcelain/files/services';
import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';

export class ReadFileAssetUseCase extends Context.Service<
  ReadFileAssetUseCase,
  {
    readonly execute: (
      input: WorktreeParams & ReadFileAssetQuery,
    ) => Effect.Effect<
      ReadFileAssetResponse,
      WorktreeAccessFailure | ReadFileAssetFailure
    >;
  }
>()('@porcelain/server/ReadFileAssetUseCase') {
  static readonly layer = Layer.effect(
    ReadFileAssetUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const readFileAssetCapability = yield* ReadFileAssetService;

      return {
        execute: Effect.fn('ReadFileAssetUseCase.execute')(function* (
          input: WorktreeParams & ReadFileAssetQuery,
        ): Effect.fn.Return<
          ReadFileAssetResponse,
          WorktreeAccessFailure | ReadFileAssetFailure
        > {
          return yield* accessCapability.read(input.worktreeId, (worktree) =>
            readFileAssetCapability.execute({
              ...input,
              worktreeId: worktree.id,
            }),
          );
        }),
      };
    }),
  );
}
