import { Effect, Context, Layer } from 'effect';
import {
  type ListReviewedLayersInput,
  type ListReviewedLayersResult,
} from '../models/list-reviewed-layers.ts';
import { ReviewStore } from '../ports/review-store.ts';
import { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';
import { reviewedLayerMarks } from '../rules/reviewed-marks.ts';

export class ListReviewedLayersService extends Context.Service<
  ListReviewedLayersService,
  {
    readonly execute: (
      input: ListReviewedLayersInput,
    ) => Effect.Effect<ListReviewedLayersResult, never>;
  }
>()('@porcelain/reviews/ListReviewedLayersService') {
  static readonly layer = Layer.effect(
    ListReviewedLayersService,
    Effect.gen(function* () {
      const reviewsCapability = yield* ReviewStore;
      const reviewedLayersCapability = yield* ReviewedLayerStore;

      return {
        execute: Effect.fn('ListReviewedLayersService.execute')(function* (
          input: ListReviewedLayersInput,
        ): Effect.fn.Return<ListReviewedLayersResult, never> {
          return yield* Effect.sync<ListReviewedLayersResult>(() => {
            const { worktreeId } = input;
            return {
              worktreeId,
              marks: reviewedLayerMarks(
                reviewedLayersCapability.list({ worktreeId }),
                reviewsCapability.read({ worktreeId })?.layers ?? [],
                input.texts,
              ),
            };
          });
        }),
      };
    }),
  );
}
