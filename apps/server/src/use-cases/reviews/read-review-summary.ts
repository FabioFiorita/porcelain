import {
  type ReadReviewSummaryParams,
  type ReadReviewSummaryQuery,
  type ReadReviewSummaryResponse,
} from '@porcelain/contracts/reviews';
import { ReadReviewSummaryService } from '@porcelain/reviews/services';
import { Lanes } from '../../runtime/lanes.ts';
import { Effect, Context, Layer } from 'effect';
import { type ReviewSummaryNotFoundError } from '@porcelain/reviews/errors';

export class ReadReviewSummaryUseCase extends Context.Service<
  ReadReviewSummaryUseCase,
  {
    readonly execute: (
      input: ReadReviewSummaryParams & ReadReviewSummaryQuery,
    ) => Effect.Effect<ReadReviewSummaryResponse, ReviewSummaryNotFoundError>;
  }
>()('@porcelain/server/ReadReviewSummaryUseCase') {
  static readonly layer = Layer.effect(
    ReadReviewSummaryUseCase,
    Effect.gen(function* () {
      const readReviewSummaryCapability = yield* ReadReviewSummaryService;
      const lanesCapability = yield* Lanes;

      return {
        execute: Effect.fn('ReadReviewSummaryUseCase.execute')(function* (
          input: ReadReviewSummaryParams & ReadReviewSummaryQuery,
        ): Effect.fn.Return<
          ReadReviewSummaryResponse,
          ReviewSummaryNotFoundError
        > {
          yield* lanesCapability.assertOpen();
          return (yield* readReviewSummaryCapability.execute({
            token: input.token,
            expires: input.expires,
            signature: input.signature,
          })).html;
        }),
      };
    }),
  );
}
