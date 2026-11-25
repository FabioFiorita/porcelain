import type { ReadPreviewFileQuery } from '@porcelain/contracts/files';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { PreviewFile } from '@porcelain/files/models';
import { ReadPreviewFileService } from '@porcelain/files/services';
import { Context, Effect, Layer, Scope } from 'effect';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';

export class ReadPreviewFileUseCase extends Context.Service<
  ReadPreviewFileUseCase,
  {
    readonly execute: (
      input: WorktreeParams & ReadPreviewFileQuery,
    ) => Effect.Effect<
      PreviewFile | undefined,
      WorktreeAccessFailure,
      Scope.Scope
    >;
  }
>()('@porcelain/server/ReadPreviewFileUseCase') {
  static readonly layer = Layer.effect(
    ReadPreviewFileUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const files = yield* ReadPreviewFileService;
      return {
        execute: Effect.fn('ReadPreviewFileUseCase.execute')(function* (input) {
          const scope = yield* Effect.scope;
          return yield* access.read(input.worktreeId, ({ id }) =>
            files
              .execute({ path: input.path, worktreeId: id })
              .pipe(Scope.provide(scope)),
          );
        }),
      };
    }),
  );
}
