import { Context, Effect, Layer } from 'effect';
import { CompareReviewService } from '@porcelain/reviews/services';
import type { CompareReviewInput } from '@porcelain/reviews/models';
import type {
  ReviewNotFoundError,
  InvalidReviewComparisonError,
} from '@porcelain/reviews/errors';
import type { CompareReviewResponse } from '@porcelain/contracts/reviews';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';

export class CompareReviewUseCase extends Context.Service<
  CompareReviewUseCase,
  {
    readonly execute: (
      input: CompareReviewInput,
    ) => Effect.Effect<
      CompareReviewResponse,
      ReviewNotFoundError | InvalidReviewComparisonError
    >;
  }
>()('@porcelain/server/CompareReviewUseCase') {
  static readonly layer = Layer.effect(
    CompareReviewUseCase,
    Effect.gen(function* () {
      const compare = yield* CompareReviewService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      return {
        execute: Effect.fn('CompareReviewUseCase.execute')((input) =>
          lanes.run(
            keys.reviews({ repositoryId: `review:${input.reviewId}` }),
            'read',
            () => compare.execute(input),
          ),
        ),
      };
    }),
  );
}
