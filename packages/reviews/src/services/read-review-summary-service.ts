import { Effect, Context, Layer, Clock, DateTime } from 'effect';
import { constantTimeEquals } from '@porcelain/kernel/rules';
import { ReviewSummaryNotFoundError } from '../errors/review-summary-not-found-error.ts';
import {
  type ReadReviewSummaryInput,
  type ReadReviewSummaryResult,
} from '../models/read-review-summary.ts';
import { ReviewStore } from '../ports/review-store.ts';
import { SignatureSource } from '../ports/signature-source.ts';
import { summaryExpired, summaryMessage } from '../rules/review-digests.ts';

export class ReadReviewSummaryService extends Context.Service<
  ReadReviewSummaryService,
  {
    readonly execute: (
      input: ReadReviewSummaryInput,
    ) => Effect.Effect<ReadReviewSummaryResult, ReviewSummaryNotFoundError>;
  }
>()('@porcelain/reviews/ReadReviewSummaryService') {
  static readonly layer = Layer.effect(
    ReadReviewSummaryService,
    Effect.gen(function* () {
      const reviewsCapability = yield* ReviewStore;
      const clockCapability = yield* Clock.Clock;
      const signatureSourceCapability = yield* SignatureSource;

      return {
        execute: Effect.fn('ReadReviewSummaryService.execute')(function* (
          input: ReadReviewSummaryInput,
        ): Effect.fn.Return<
          ReadReviewSummaryResult,
          ReviewSummaryNotFoundError
        > {
          const summary = yield* reviewsCapability.findSummary({
            token: input.token,
          });
          if (
            summary === undefined ||
            summaryExpired(
              input.expires,
              DateTime.formatIso(
                DateTime.makeUnsafe(yield* clockCapability.currentTimeMillis),
              ),
            ) ||
            !constantTimeEquals(
              signatureSourceCapability.sign({
                secret: summary.summarySecret,
                message: summaryMessage(input.token, input.expires),
              }),
              input.signature,
            )
          )
            return yield* Effect.fail(new ReviewSummaryNotFoundError());
          return { html: summary.summaryHtml };
        }),
      };
    }),
  );
}
