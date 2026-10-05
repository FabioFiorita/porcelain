import { Effect, Context, Layer } from 'effect';
import {
  type InvalidateReviewedMarksInput,
  type InvalidateReviewedMarksResult,
} from '../models/invalidate-reviewed-marks.ts';
import { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import { touchedMarks } from '../rules/reviewed-marks.ts';

export class InvalidateReviewedMarksService extends Context.Service<
  InvalidateReviewedMarksService,
  {
    readonly execute: (
      input: InvalidateReviewedMarksInput,
    ) => Effect.Effect<InvalidateReviewedMarksResult, never>;
  }
>()('@porcelain/reviews/InvalidateReviewedMarksService') {
  static readonly layer = Layer.effect(
    InvalidateReviewedMarksService,
    Effect.gen(function* () {
      const reviewedFilesCapability = yield* ReviewedFileStore;

      return {
        execute: Effect.fn('InvalidateReviewedMarksService.execute')(function* (
          input: InvalidateReviewedMarksInput,
        ): Effect.fn.Return<InvalidateReviewedMarksResult, never> {
          return yield* Effect.sync<InvalidateReviewedMarksResult>(() => {
            const { worktreeId, paths } = input;
            if (paths?.length === 0) return { changed: false };
            const files = touchedMarks(
              reviewedFilesCapability
                .list({ worktreeId })
                .filter((mark) => !mark.stale)
                .map((mark) => mark.path),
              paths,
            );
            reviewedFilesCapability.setStale({
              worktreeId,
              paths: files,
              stale: true,
            });
            return { changed: files.length > 0 };
          });
        }),
      };
    }),
  );
}
