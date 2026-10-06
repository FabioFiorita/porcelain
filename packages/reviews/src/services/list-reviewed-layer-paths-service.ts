import { Effect, Context, Layer } from 'effect';
import {
  type ListReviewedLayerPathsInput,
  type ListReviewedLayerPathsResult,
} from '../models/list-reviewed-layer-paths.ts';
import { ReviewStore } from '../ports/review-store.ts';
import { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';
import { markedLayers } from '../rules/reviewed-marks.ts';
import { reviewPaths } from '../rules/review-evidence.ts';

export class ListReviewedLayerPathsService extends Context.Service<
  ListReviewedLayerPathsService,
  {
    readonly execute: (
      input: ListReviewedLayerPathsInput,
    ) => Effect.Effect<ListReviewedLayerPathsResult, never>;
  }
>()('@porcelain/reviews/ListReviewedLayerPathsService') {
  static readonly layer = Layer.effect(
    ListReviewedLayerPathsService,
    Effect.gen(function* () {
      const reviewsCapability = yield* ReviewStore;
      const reviewedLayersCapability = yield* ReviewedLayerStore;

      return {
        execute: Effect.fn('ListReviewedLayerPathsService.execute')(function* (
          input: ListReviewedLayerPathsInput,
        ): Effect.fn.Return<ListReviewedLayerPathsResult, never> {
          const { worktreeId } = input;
          const layers = markedLayers(
            (yield* reviewsCapability.read({ worktreeId }))?.layers ?? [],
            yield* reviewedLayersCapability.list({ worktreeId }),
          );
          return { paths: reviewPaths(layers, []) };
        }),
      };
    }),
  );
}
