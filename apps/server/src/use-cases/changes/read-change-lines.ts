import { type MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import { Context, Effect, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { type InvalidLineRangeError } from '@porcelain/kernel/errors';
import { ReadEnvironmentService } from '@porcelain/access/services';
import { ReadChangeLinesService } from '@porcelain/changes/services';
import {
  type ReadChangeLinesQuery,
  type ReadChangeLinesResponse,
} from '@porcelain/contracts/changes';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import {
  ReadTextFileService,
  type ReadTextFileFailure,
} from '@porcelain/files/services';

export class ReadChangeLinesUseCase extends Context.Service<
  ReadChangeLinesUseCase,
  {
    readonly execute: (
      input: WorktreeParams & ReadChangeLinesQuery,
    ) => Effect.Effect<
      ReadChangeLinesResponse,
      | MissingEnvironmentIdentityError
      | WorktreeAccessFailure
      | ReadTextFileFailure
      | InvalidLineRangeError
    >;
  }
>()('@porcelain/server/ReadChangeLinesUseCase') {
  static readonly layer = Layer.effect(
    ReadChangeLinesUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const readTextFileCapability = yield* ReadTextFileService;
      const readChangeLinesCapability = yield* ReadChangeLinesService;
      const readEnvironmentCapability = yield* ReadEnvironmentService;

      return {
        execute: Effect.fn('ReadChangeLinesUseCase.execute')(function* (
          input: WorktreeParams & ReadChangeLinesQuery,
        ): Effect.fn.Return<
          ReadChangeLinesResponse,
          | MissingEnvironmentIdentityError
          | WorktreeAccessFailure
          | ReadTextFileFailure
          | InvalidLineRangeError
        > {
          return yield* Effect.suspend(() => {
            const { worktreeId, path, from, to, at } = input;
            return accessCapability.read(worktreeId, () =>
              Effect.gen(function* () {
                const { text } = yield* readTextFileCapability.execute({
                  worktreeId,
                  path,
                  at,
                });
                const lines = yield* readChangeLinesCapability.execute({
                  path,
                  from,
                  to,
                  at,
                  text,
                });
                return {
                  environmentId: (yield* readEnvironmentCapability.execute())
                    .environmentId,
                  worktreeId,
                  ...lines,
                };
              }),
            );
          });
        }),
      };
    }),
  );
}
