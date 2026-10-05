import {
  type ReadTextFileQuery,
  type ReadTextFileResponse,
} from '@porcelain/contracts/files';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import {
  ReadTextFileService,
  type ReadTextFileFailure,
} from '@porcelain/files/services';
import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';

export class ReadTextFileUseCase extends Context.Service<
  ReadTextFileUseCase,
  {
    readonly execute: (
      input: WorktreeParams & ReadTextFileQuery,
    ) => Effect.Effect<
      ReadTextFileResponse,
      WorktreeAccessFailure | ReadTextFileFailure
    >;
  }
>()('@porcelain/server/ReadTextFileUseCase') {
  static readonly layer = Layer.effect(
    ReadTextFileUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const readTextFileCapability = yield* ReadTextFileService;

      return {
        execute: Effect.fn('ReadTextFileUseCase.execute')(function* (
          input: WorktreeParams & ReadTextFileQuery,
        ): Effect.fn.Return<
          ReadTextFileResponse,
          WorktreeAccessFailure | ReadTextFileFailure
        > {
          return yield* accessCapability.read(input.worktreeId, (worktree) =>
            readTextFileCapability.execute({
              ...input,
              worktreeId: worktree.id,
            }),
          );
        }),
      };
    }),
  );
}
