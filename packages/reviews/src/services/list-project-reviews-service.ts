import type { ReviewDiagram } from '../models/review.ts';
import { reviewGuards } from '../rules/review-guards.ts';
import { Context, Effect, Layer } from 'effect';
import type { ReviewRecord } from '../models/review.ts';

import { ReviewStore } from '../ports/review-store.ts';

export class ListProjectReviewsService extends Context.Service<
  ListProjectReviewsService,
  {
    readonly execute: (input: { projectId: string }) => Effect.Effect<
      readonly (ReviewRecord & {
        diagram?: ReviewDiagram | undefined;
        guards?: readonly string[];
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
                        ...(review.diagram === undefined
                          ? {}
                          : { diagram: review.diagram }),
                        guards: reviewGuards(review.files),
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
