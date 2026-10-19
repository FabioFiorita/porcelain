import { Context, Effect, Layer } from 'effect';
import type {
  NoWorktreeAtPathError,
  ProjectNotFoundError,
} from '@porcelain/projects/errors';
import { FindWorktreeByPathUseCasePort } from '../../ports/at-worktree-path-use-case-port.ts';
import type { AtReviewScopeExecution } from '../../ports/at-review-scope-use-case-port.ts';

export class AtReviewScopeUseCase extends Context.Service<
  AtReviewScopeUseCase,
  {
    readonly execute: <Request, Result, Failure>(
      input: AtReviewScopeExecution<Request, Result, Failure>,
    ) => Effect.Effect<
      Result,
      Failure | NoWorktreeAtPathError | ProjectNotFoundError
    >;
  }
>()('@porcelain/server/AtReviewScopeUseCase') {
  static readonly layer = Layer.effect(
    AtReviewScopeUseCase,
    Effect.gen(function* () {
      const find = yield* FindWorktreeByPathUseCasePort;
      return {
        execute: Effect.fn('AtReviewScopeUseCase.execute')(function* <
          Request,
          Result,
          Failure,
        >(input: AtReviewScopeExecution<Request, Result, Failure>) {
          if (input.reviewId !== undefined)
            return yield* input.operation.execute({
              ...input.request,
              reviewId: input.reviewId,
            });
          const { worktreeId } = yield* find.execute({ path: input.cwd });
          return yield* input.operation.execute({
            ...input.request,
            worktreeId,
          });
        }),
      };
    }),
  );
}
