import { reviewedLayerMarks } from '../rules/reviewed-marks.ts';
import { Effect, Context, Layer } from 'effect';
import {
  type ListReviewedLayersInput,
  type ListReviewedLayersResult,
} from '../models/list-reviewed-layers.ts';
import { BranchReviewReader } from '../ports/branch-review-reader.ts';
import { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';

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
      const reviewsCapability = yield* BranchReviewReader;
      const reviewedLayersCapability = yield* ReviewedLayerStore;

      return {
        execute: Effect.fn('ListReviewedLayersService.execute')(function* (
          input: ListReviewedLayersInput,
        ): Effect.fn.Return<ListReviewedLayersResult, never> {
          const { worktreeId } = input;
          const review = yield* reviewsCapability.read({ worktreeId });
          const marks =
            review === undefined
              ? []
              : yield* reviewedLayersCapability.list({
                  reviewId: review.reviewId,
                });
          return {
            worktreeId,
            marks: reviewedLayerMarks(marks, review?.layers ?? []),
          };
        }),
      };
    }),
  );
}
