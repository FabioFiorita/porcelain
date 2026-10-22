import type { ReviewRevisionParams } from '@porcelain/contracts/reviews';
import { ReadPublishedReviewService } from '@porcelain/reviews/services';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import type { ProofFileNotFoundError } from '@porcelain/reviews/errors';
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
      input: (WorktreeParams | ReviewRevisionParams) & ReadProofFileQuery,
    ) => Effect.Effect<
      ReadProofFileResponse,
      WorktreeAccessFailure | ProofFileNotFoundError
    >;
  }
>()('@porcelain/server/ReadProofFileUseCase') {
  static readonly layer = Layer.effect(
    ReadProofFileUseCase,
    Effect.gen(function* () {
      const branches = yield* ReadPublishedReviewService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      const accessCapability = yield* WorktreeAccess;
      const readProofFileCapability = yield* ReadProofFileService;

      return {
        execute: Effect.fn('ReadProofFileUseCase.execute')(function* (
          input: (WorktreeParams | ReviewRevisionParams) & ReadProofFileQuery,
        ): Effect.fn.Return<
          ReadProofFileResponse,
          WorktreeAccessFailure | ProofFileNotFoundError
        > {
          if ('reviewId' in input)
            return yield* lanes.run(
              keys.reviews({ repositoryId: `review:${input.reviewId}` }),
              'read',
              () => readProofFileCapability.execute(input),
            );
          const { worktreeId, proofId } = input;
          return yield* accessCapability.reviews(worktreeId, 'read', () =>
            Effect.gen(function* () {
              const published = yield* branches.execute({ worktreeId });
              if (published.kind === 'none')
                return yield* readProofFileCapability.execute({
                  reviewId: '',
                  proofId,
                });
              const review = published.review;
              return yield* readProofFileCapability.execute({
                reviewId: review.reviewId,
                revision: review.revision,
                proofId,
              });
            }),
          );
        }),
      };
    }),
  );
}
