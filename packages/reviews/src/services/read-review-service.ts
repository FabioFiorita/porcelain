import { BranchReviewReader } from '../ports/branch-review-reader.ts';
import { Context, Effect, Layer } from 'effect';

import type {
  ReadReviewSelection,
  ReadReviewResult,
} from '../models/review-management.ts';
import { ReviewNotFoundError } from '../errors/review-not-found-error.ts';
import { ReviewStore } from '../ports/review-store.ts';

export class ReadReviewService extends Context.Service<
  ReadReviewService,
  {
    readonly execute: (
      input: ReadReviewSelection,
    ) => Effect.Effect<ReadReviewResult | undefined, ReviewNotFoundError>;
  }
>()('@porcelain/reviews/ReadReviewService') {
  static readonly layer = Layer.effect(
    ReadReviewService,
    Effect.gen(function* () {
      const branches = yield* BranchReviewReader;
      const reviews = yield* ReviewStore;
      return {
        execute: Effect.fn('ReadReviewService.execute')(function* (input) {
          const reviewId =
            'reviewId' in input
              ? input.reviewId
              : (yield* branches.read({ worktreeId: input.worktreeId }))
                  ?.reviewId;
          if (reviewId === undefined) return undefined;
          const record = yield* reviews.readRecord({ reviewId });
          if (record === undefined) return yield* new ReviewNotFoundError();
          const revision = yield* reviews.read({
            reviewId,
            revision: input.revision ?? record.latestRevision,
          });
          if (revision === undefined) return yield* new ReviewNotFoundError();
          return {
            record,
            revision,
            revisions: (yield* reviews.listRevisions({ reviewId })).filter(
              (item) => item.revision <= record.latestRevision,
            ),
          };
        }),
      };
    }),
  );
}
