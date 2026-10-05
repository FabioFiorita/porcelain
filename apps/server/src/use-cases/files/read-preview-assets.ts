import {
  type ReadPreviewAssetsRequest,
  type ReadPreviewAssetsResponse,
} from '@porcelain/contracts/files';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import { ReadPreviewAssetsService } from '@porcelain/files/services';
import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';

export class ReadPreviewAssetsUseCase extends Context.Service<
  ReadPreviewAssetsUseCase,
  {
    readonly execute: (
      input: WorktreeParams & ReadPreviewAssetsRequest,
    ) => Effect.Effect<ReadPreviewAssetsResponse, WorktreeAccessFailure>;
  }
>()('@porcelain/server/ReadPreviewAssetsUseCase') {
  static readonly layer = Layer.effect(
    ReadPreviewAssetsUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const readPreviewAssetsCapability = yield* ReadPreviewAssetsService;

      return {
        execute: Effect.fn('ReadPreviewAssetsUseCase.execute')(function* (
          input: WorktreeParams & ReadPreviewAssetsRequest,
        ): Effect.fn.Return<ReadPreviewAssetsResponse, WorktreeAccessFailure> {
          return yield* accessCapability.read(input.worktreeId, (worktree) =>
            readPreviewAssetsCapability.execute({
              ...input,
              worktreeId: worktree.id,
            }),
          );
        }),
      };
    }),
  );
}
