import { SetReviewedFilesOptions } from '../ports/set-reviewed-files-options.ts';
import { Effect, Context, Layer, Clock, DateTime } from 'effect';
import { ReviewedMarkConflictError } from '../errors/reviewed-mark-conflict-error.ts';
import {
  type SetReviewedFilesInput,
  type SetReviewedFilesResult,
} from '../models/set-reviewed-files.ts';
import { ReviewedFileStore } from '../ports/reviewed-file-store.ts';
import {
  evictedPaths,
  reviewedMarks,
  selectReviewedFiles,
} from '../rules/reviewed-marks.ts';

export class SetReviewedFilesService extends Context.Service<
  SetReviewedFilesService,
  {
    readonly execute: (
      input: SetReviewedFilesInput,
    ) => Effect.Effect<SetReviewedFilesResult, ReviewedMarkConflictError>;
  }
>()('@porcelain/reviews/SetReviewedFilesService') {
  static readonly layer = Layer.effect(
    SetReviewedFilesService,
    Effect.gen(function* () {
      const reviewedFilesCapability = yield* ReviewedFileStore;
      const clockCapability = yield* Clock.Clock;
      const optionsCapability = yield* SetReviewedFilesOptions;

      return {
        execute: Effect.fn('SetReviewedFilesService.execute')(function* (
          input: SetReviewedFilesInput,
        ): Effect.fn.Return<SetReviewedFilesResult, ReviewedMarkConflictError> {
          const { worktreeId, scope, branch } = input;
          const key = { worktreeId, scope, branch };
          const { marked, conflicts } = selectReviewedFiles(
            input.files,
            input.changes,
          );
          if (input.onConflict === 'refuse' && conflicts.length > 0)
            return yield* Effect.fail(new ReviewedMarkConflictError());
          const evicted = evictedPaths(
            yield* reviewedFilesCapability.list(key),
            marked,
            scope === 'branch'
              ? (optionsCapability.marksPerBranch ??
                  optionsCapability.marksPerWorktree)
              : optionsCapability.marksPerWorktree,
            new Set(input.changes.map((change) => change.path)),
          );
          yield* reviewedFilesCapability.remove({ ...key, paths: evicted });
          const reviewedAt = DateTime.formatIso(
            DateTime.makeUnsafe(yield* clockCapability.currentTimeMillis),
          );
          yield* reviewedFilesCapability.save({
            ...key,
            marks: marked.map((file) => ({
              ...file,
              reviewedAt,
              stale: false,
            })),
          });
          return {
            worktreeId,
            marks: reviewedMarks(yield* reviewedFilesCapability.list(key)),
            marked: marked.map((file) => file.path),
            conflicts,
            changed: marked.length > 0 || evicted.length > 0,
          };
        }),
      };
    }),
  );
}
