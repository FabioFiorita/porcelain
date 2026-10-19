import { Context, Effect, Layer } from 'effect';
import { ListReviewMarksService } from '@porcelain/reviews/services';
import type { ReviewNotFoundError } from '@porcelain/reviews/errors';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import type { ReviewMarksResponse } from '@porcelain/contracts/reviews';

export class ListReviewMarksUseCase extends Context.Service<
  ListReviewMarksUseCase,
  {
    readonly execute: (input: {
      reviewId: string;
    }) => Effect.Effect<ReviewMarksResponse, ReviewNotFoundError>;
  }
>()('@porcelain/server/ListReviewMarksUseCase') {
  static readonly layer = Layer.effect(
    ListReviewMarksUseCase,
    Effect.gen(function* () {
      const operation = yield* ListReviewMarksService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      return {
        execute: Effect.fn('ListReviewMarksUseCase.execute')(function* (input) {
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
