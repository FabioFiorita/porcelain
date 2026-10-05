import { Effect, Context, Layer } from 'effect';
import {
  type ListReviewedFilesInput,
  type ListReviewedFilesResult,
} from '../models/list-reviewed-files.ts';
import { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import { reviewedMarks } from '../rules/reviewed-marks.ts';

export class ListReviewedFilesService extends Context.Service<
  ListReviewedFilesService,
  {
    readonly execute: (
      input: ListReviewedFilesInput,
    ) => Effect.Effect<ListReviewedFilesResult, never>;
  }
>()('@porcelain/reviews/ListReviewedFilesService') {
  static readonly layer = Layer.effect(
    ListReviewedFilesService,
    Effect.gen(function* () {
      const reviewedFilesCapability = yield* ReviewedFileStore;

      return {
        execute: Effect.fn('ListReviewedFilesService.execute')(function* (
          input: ListReviewedFilesInput,
        ): Effect.fn.Return<ListReviewedFilesResult, never> {
          return yield* Effect.sync<ListReviewedFilesResult>(() => {
            const { worktreeId, scope, branch } = input;
            return {
              worktreeId,
              marks: reviewedMarks(
                reviewedFilesCapability.list({ worktreeId, scope, branch }),
              ),
            };
          });
        }),
      };
    }),
  );
}
