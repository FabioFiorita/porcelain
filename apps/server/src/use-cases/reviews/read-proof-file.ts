import { type ProofFileNotFoundError } from '@porcelain/reviews/errors';
import { Effect, Context, Layer } from 'effect';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { type WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import {
  type ReadProofFileQuery,
  type ReadProofFileResponse,
} from '@porcelain/contracts/reviews';
import { type WorktreeParams } from '@porcelain/contracts/shared';
import { ReadProofFileService } from '@porcelain/reviews/services';

export class ReadProofFileUseCase extends Context.Service<
  ReadProofFileUseCase,
  {
    readonly execute: (
      input: WorktreeParams & ReadProofFileQuery,
    ) => Effect.Effect<
      ReadProofFileResponse,
      WorktreeAccessFailure | ProofFileNotFoundError
    >;
  }
>()('@porcelain/server/ReadProofFileUseCase') {
  static readonly layer = Layer.effect(
    ReadProofFileUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const readProofFileCapability = yield* ReadProofFileService;

      return {
        execute: Effect.fn('ReadProofFileUseCase.execute')(function* (
          input: WorktreeParams & ReadProofFileQuery,
        ): Effect.fn.Return<
          ReadProofFileResponse,
          WorktreeAccessFailure | ProofFileNotFoundError
        > {
          const { worktreeId, proofId } = input;
          return yield* accessCapability.reviews(worktreeId, 'read', () =>
            Effect.gen(function* () {
              return yield* readProofFileCapability.execute({
                worktreeId,
                proofId,
              });
            }),
          );
        }),
      };
    }),
  );
}
