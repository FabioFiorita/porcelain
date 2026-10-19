import { Context, Effect, Layer } from 'effect';

import type { RemoveReviewMarkInput } from '../models/review-management.ts';
import { ReviewNotFoundError } from '../errors/review-not-found-error.ts';
import { ReviewStore } from '../ports/review-store.ts';
import { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';

export class RemoveReviewMarkService extends Context.Service<
  RemoveReviewMarkService,
  {
    readonly execute: (
      input: RemoveReviewMarkInput,
    ) => Effect.Effect<{ updated: boolean }, ReviewNotFoundError>;
  }
>()('@porcelain/reviews/RemoveReviewMarkService') {
  static readonly layer = Layer.effect(
    RemoveReviewMarkService,
    Effect.gen(function* () {
      const reviews = yield* ReviewStore;
      const files = yield* ReviewedFileStore;
      const layers = yield* ReviewedLayerStore;
      return {
        execute: Effect.fn('RemoveReviewMarkService.execute')(
          function* (input) {
            if ((yield* reviews.readRecord(input)) === undefined)
              return yield* new ReviewNotFoundError();
            if (input.kind === 'file')
              yield* files.remove({
                reviewId: input.reviewId,
                paths: [input.path],
                fingerprint: input.headBlobOid,
              });
            else
              yield* layers.remove({
                reviewId: input.reviewId,
                layerId: input.layerId,
                fingerprint: input.fingerprint,
              });
            return { updated: true };
          },
        ),
      };
    }),
  );
}
