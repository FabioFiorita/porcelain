import { type ReadPreviewAssetsRequest } from '@porcelain/contracts/files';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import type { ReadPreviewAssetsResult } from '@porcelain/files/models';
import {
  ReadPreviewAssetsService,
  ReadPreviewFileService,
} from '@porcelain/files/services';
import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';

export class ReadPreviewAssetsUseCase extends Context.Service<
  ReadPreviewAssetsUseCase,
  {
    readonly execute: (
      input: WorktreeParams & ReadPreviewAssetsRequest,
    ) => Effect.Effect<ReadPreviewAssetsResult, WorktreeAccessFailure>;
  }
>()('@porcelain/server/ReadPreviewAssetsUseCase') {
  static readonly layer = Layer.effect(
    ReadPreviewAssetsUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const readPreviewAssetsCapability = yield* ReadPreviewAssetsService;
      const files = yield* ReadPreviewFileService;

      return {
        execute: Effect.fn('ReadPreviewAssetsUseCase.execute')(function* (
          input: WorktreeParams & ReadPreviewAssetsRequest,
        ): Effect.fn.Return<ReadPreviewAssetsResult, WorktreeAccessFailure> {
          return yield* accessCapability.read(input.worktreeId, (worktree) =>
            readPreviewAssetsCapability.execute({
              ...input,
              worktreeId: worktree.id,
              ...(input.streamMedia
                ? {
                    canStream: (path: string) =>
                      Effect.scoped(
                        files.execute({ worktreeId: worktree.id, path }),
                      ).pipe(Effect.map((file) => file !== undefined)),
                  }
                : {}),
            }),
          );
        }),
      };
    }),
  );
}
