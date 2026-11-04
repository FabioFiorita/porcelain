import { Context, Effect, Layer, Clock, DateTime } from 'effect';

import type { SetReviewMarkInput } from '../models/review-management.ts';
import { ReviewNotFoundError } from '../errors/review-not-found-error.ts';
import { ReviewedMarkConflictError } from '../errors/reviewed-mark-conflict-error.ts';
import { ReviewStore } from '../ports/review-store.ts';
import { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';

export class SetReviewMarkService extends Context.Service<
  SetReviewMarkService,
  {
    readonly execute: (
      input: SetReviewMarkInput,
    ) => Effect.Effect<
      { updated: boolean },
      ReviewNotFoundError | ReviewedMarkConflictError
    >;
  }
>()('@porcelain/reviews/SetReviewMarkService') {
  static readonly layer = Layer.effect(
    SetReviewMarkService,
    Effect.gen(function* () {
      const reviews = yield* ReviewStore;
      const files = yield* ReviewedFileStore;
      const layers = yield* ReviewedLayerStore;
      const clock = yield* Clock.Clock;
      return {
        execute: Effect.fn('SetReviewMarkService.execute')(function* (input) {
          const review = yield* reviews.read({
            reviewId: input.reviewId,
            revision: input.revision,
          });
          if (review === undefined) return yield* new ReviewNotFoundError();
          const reviewedAt = DateTime.formatIso(
            DateTime.makeUnsafe(yield* clock.currentTimeMillis),
          );
          if (input.kind === 'file') {
            const file = review.files.find((file) => file.path === input.path);
            if (
              file === undefined ||
              (file.newOid ?? file.oldOid) !== input.headBlobOid
            )
              return yield* new ReviewedMarkConflictError();
            yield* files.save({
              reviewId: input.reviewId,
              marks: [
                {
                  path: input.path,
                  fingerprint: input.headBlobOid,
                  reviewedAt,
                  stale: false,
                },
              ],
            });
          } else {
            if (
              !review.layers.some(
                (layer) =>
                  layer.id === input.layerId &&
                  layer.fingerprint === input.fingerprint,
              )
            )
              return yield* new ReviewedMarkConflictError();
            yield* layers.save({
              reviewId: input.reviewId,
              marks: [
                {
                  layerId: input.layerId,
                  fingerprint: input.fingerprint,
                  reviewedAt,
                },
              ],
            });
          }
          return { updated: true };
        }),
      };
    }),
  );
}
