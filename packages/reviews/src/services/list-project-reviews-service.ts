import type { ReviewSystem } from '../models/review-system.ts';
import { Context, Effect, Layer } from 'effect';
import type { ReviewRecord } from '../models/review.ts';

import { ReviewStore } from '../ports/review-store.ts';

export class ListProjectReviewsService extends Context.Service<
  ListProjectReviewsService,
  {
    readonly execute: (input: { projectId: string }) => Effect.Effect<
      readonly (ReviewRecord & {
        system?: ReviewSystem | undefined;
        publishedAt?: string;
        title?: string;
      })[],
      never
    >;
  }
>()('@porcelain/reviews/ListProjectReviewsService') {
  static readonly layer = Layer.effect(
    ListProjectReviewsService,
    Effect.gen(function* () {
      const reviews = yield* ReviewStore;
      return {
        execute: Effect.fn('ListProjectReviewsService.execute')(
          function* (input) {
            return yield* Effect.forEach(yield* reviews.list(input), (record) =>
              Effect.gen(function* () {
                const review = yield* reviews.read({
                  reviewId: record.reviewId,
                });
                return {
                  ...record,
                  ...(review
                    ? {
                        ...(review.system === undefined
                          ? {}
                          : { system: review.system }),
                        publishedAt: review.publishedAt,
                        title: review.verdict.asked.text,
                      }
                    : {}),
                };
              }),
            );
          },
        ),
      };
    }),
  );
}
