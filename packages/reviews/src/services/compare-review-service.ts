import { Context, Effect, Layer } from 'effect';
import type {
  CompareReviewInput,
  CompareReviewResult,
} from '../models/review-comparison.ts';
import type { ReviewNotFoundError } from '../errors/review-not-found-error.ts';
import type { InvalidReviewComparisonError } from '../errors/invalid-review-comparison-error.ts';
import { SelectReviewComparisonService } from './select-review-comparison-service.ts';
import { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';
import { CommentStore } from '../ports/comment-store.ts';
import { compareReviewRevisions } from '../rules/review-comparison.ts';

export class CompareReviewService extends Context.Service<
  CompareReviewService,
  {
    readonly execute: (
      input: CompareReviewInput,
    ) => Effect.Effect<
      CompareReviewResult,
      ReviewNotFoundError | InvalidReviewComparisonError
    >;
  }
>()('@porcelain/reviews/CompareReviewService') {
  static readonly layer = Layer.effect(
    CompareReviewService,
    Effect.gen(function* () {
      const select = yield* SelectReviewComparisonService;
      const files = yield* ReviewedFileStore;
      const decisions = yield* ReviewedLayerStore;
      const comments = yield* CommentStore;
      return {
        execute: Effect.fn('CompareReviewService.execute')(function* (input) {
          const { from, to } = yield* select.execute(input);
          if (from === undefined)
            return {
              reviewId: input.reviewId,
              from: undefined,
              to: to.revision,
              comparison: undefined,
              unknown: [
                {
                  area: 'baseline' as const,
                  reason:
                    'This review has no last seen revision. Select an explicit from revision.',
                  ids: [],
                },
              ],
            };
          const comparison = compareReviewRevisions(from, to, {
            marks: {
              files: yield* files.list(input),
              decisions: yield* decisions.list(input),
            },
            threads: yield* comments.list(input),
          });
          return {
            reviewId: input.reviewId,
            from: from.revision,
            to: to.revision,
            comparison,
            unknown: comparison.unknown,
          };
        }),
      };
    }),
  );
}
