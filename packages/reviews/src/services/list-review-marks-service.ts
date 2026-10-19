import { Context, Effect, Layer } from 'effect';

import type { ReviewMarks } from '../models/review-management.ts';
import { ReviewNotFoundError } from '../errors/review-not-found-error.ts';
import { ReviewStore } from '../ports/review-store.ts';
import { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';

export class ListReviewMarksService extends Context.Service<
  ListReviewMarksService,
  {
    readonly execute: (input: {
      reviewId: string;
    }) => Effect.Effect<ReviewMarks, ReviewNotFoundError>;
  }
>()('@porcelain/reviews/ListReviewMarksService') {
  static readonly layer = Layer.effect(
    ListReviewMarksService,
    Effect.gen(function* () {
      const reviews = yield* ReviewStore;
      const files = yield* ReviewedFileStore;
      const layers = yield* ReviewedLayerStore;
      return {
        execute: Effect.fn('ListReviewMarksService.execute')(function* (input) {
          if ((yield* reviews.readRecord(input)) === undefined)
            return yield* new ReviewNotFoundError();
          return {
            files: yield* files.list(input),
            decisions: yield* layers.list(input),
          };
        }),
      };
    }),
  );
}
