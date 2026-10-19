import { Context, Effect, Layer } from 'effect';
import { ReadReviewFileService } from '@porcelain/reviews/services';
import type { ReviewNotFoundError } from '@porcelain/reviews/errors';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import type { readReviewFileResponseSchema } from '@porcelain/contracts/reviews';

export class ReadReviewFileUseCase extends Context.Service<
  ReadReviewFileUseCase,
  {
    readonly execute: (input: {
      reviewId: string;
      revision: number;
      path: string;
    }) => Effect.Effect<
      typeof readReviewFileResponseSchema.Type,
      ReviewNotFoundError
    >;
  }
>()('@porcelain/server/ReadReviewFileUseCase') {
  static readonly layer = Layer.effect(
    ReadReviewFileUseCase,
    Effect.gen(function* () {
      const operation = yield* ReadReviewFileService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      return {
        execute: Effect.fn('ReadReviewFileUseCase.execute')(function* (input) {
          return yield* lanes.run(
            keys.reviews({ repositoryId: `review:${input.reviewId}` }),
            'read',
            () =>
              Effect.gen(function* () {
                return yield* operation.execute(input);
              }),
          );
        }),
      };
    }),
  );
}
