import {
  type AtPathExecution,
  FindWorktreeByPathUseCasePort,
} from '../../ports/at-worktree-path-use-case-port.ts';
import { Context, Effect, Layer } from 'effect';
import {
  type NoWorktreeAtPathError,
  type ProjectNotFoundError,
} from '@porcelain/projects/errors';

export class AtWorktreePathUseCase extends Context.Service<
  AtWorktreePathUseCase,
  {
    readonly execute: <Request, Result, Failure>(
      input: AtPathExecution<Request, Result, Failure>,
    ) => Effect.Effect<
      Result,
      Failure | NoWorktreeAtPathError | ProjectNotFoundError
    >;
  }
>()('@porcelain/server/AtWorktreePathUseCase') {
  static readonly layer = Layer.effect(
    AtWorktreePathUseCase,
    Effect.gen(function* () {
      const findWorktreeByPath = yield* FindWorktreeByPathUseCasePort;
      return {
        execute: Effect.fn('AtWorktreePathUseCase.execute')(function* <
          Request,
          Result,
          Failure,
        >(
          input: AtPathExecution<Request, Result, Failure>,
        ): Effect.fn.Return<
          Result,
          Failure | NoWorktreeAtPathError | ProjectNotFoundError
        > {
          const { worktreeId } = yield* findWorktreeByPath.execute({
            path: input.cwd,
          });
          return yield* input.operation.execute({
            ...input.request,
            worktreeId,
          });
        }),
      };
    }),
  );
}
