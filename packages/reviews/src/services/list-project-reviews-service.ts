import { Context, Effect, Layer } from 'effect';
import type { ReviewRecord } from '../models/review.ts';

import { ReviewStore } from '../ports/review-store.ts';

export class ListProjectReviewsService extends Context.Service<
  ListProjectReviewsService,
  {
    readonly execute: (input: {
      projectId: string;
    }) => Effect.Effect<readonly ReviewRecord[], never>;
  }
>()('@porcelain/reviews/ListProjectReviewsService') {
  static readonly layer = Layer.effect(
    ListProjectReviewsService,
    Effect.gen(function* () {
      const reviews = yield* ReviewStore;
      return {
        execute: Effect.fn('ListProjectReviewsService.execute')(
          function* (input) {
            return yield* reviews.list(input);
          },
        ),
      };
    }),
  );
}
