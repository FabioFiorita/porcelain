import { Effect, Context, Layer } from 'effect';
import {
  type RemoveReviewedFilesInput,
  type RemoveReviewedFilesResult,
} from '../models/remove-reviewed-files.ts';
import { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import { reviewedMarks } from '../rules/reviewed-marks.ts';

export class RemoveReviewedFilesService extends Context.Service<
  RemoveReviewedFilesService,
  {
    readonly execute: (
      input: RemoveReviewedFilesInput,
    ) => Effect.Effect<RemoveReviewedFilesResult, never>;
  }
>()('@porcelain/reviews/RemoveReviewedFilesService') {
  static readonly layer = Layer.effect(
    RemoveReviewedFilesService,
    Effect.gen(function* () {
      const reviewedFilesCapability = yield* ReviewedFileStore;

      return {
        execute: Effect.fn('RemoveReviewedFilesService.execute')(function* (
          input: RemoveReviewedFilesInput,
        ): Effect.fn.Return<RemoveReviewedFilesResult, never> {
          const { worktreeId, scope, branch } = input;
          const wanted = new Set(input.paths);
          const removed = (yield* reviewedFilesCapability.list({
            worktreeId,
            scope,
            branch,
          }))
            .filter((mark) => wanted.has(mark.path))
            .map((mark) => mark.path);
          yield* reviewedFilesCapability.remove({
            worktreeId,
            scope,
            branch,
            paths: removed,
          });
          return {
            worktreeId,
            marks: reviewedMarks(
              yield* reviewedFilesCapability.list({
                worktreeId,
                scope,
                branch,
              }),
            ),
            removed: removed.length > 0,
          };
        }),
      };
    }),
  );
}
