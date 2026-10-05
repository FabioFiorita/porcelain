import {
  ReadChangeDiffsService,
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import { ReadTextFilesService } from '@porcelain/files/services';
import {
  type ReadReviewEvidenceInput,
  type ReviewEvidence,
} from '@porcelain/reviews/models';
import { reviewPaths, trackedComparisons } from '@porcelain/reviews/rules';
import { Effect, Context, Layer } from 'effect';
import { type WorktreeRead } from '@porcelain/effects';
import { type GitIoFailure } from '@porcelain/git/errors';
import { type IncompleteDiffReadError } from '@porcelain/changes/errors';

export class ReadReviewEvidenceUseCase extends Context.Service<
  ReadReviewEvidenceUseCase,
  {
    readonly execute: (
      input: ReadReviewEvidenceInput,
    ) => Effect.Effect<
      ReviewEvidence,
      GitIoFailure | IncompleteDiffReadError,
      WorktreeRead
    >;
  }
>()('@porcelain/server/ReadReviewEvidenceUseCase') {
  static readonly layer = Layer.effect(
    ReadReviewEvidenceUseCase,
    Effect.gen(function* () {
      const readWorktreeStatusCapability = yield* ReadWorktreeStatusService;
      const readChangeFingerprintsCapability =
        yield* ReadChangeFingerprintsService;
      const readTextFilesCapability = yield* ReadTextFilesService;
      const readChangeDiffsCapability = yield* ReadChangeDiffsService;

      return {
        execute: Effect.fn('ReadReviewEvidenceUseCase.execute')(function* (
          input: ReadReviewEvidenceInput,
        ): Effect.fn.Return<
          ReviewEvidence,
          GitIoFailure | IncompleteDiffReadError,
          WorktreeRead
        > {
          const { worktreeId } = input;
          const status = yield* readWorktreeStatusCapability.execute({
            worktreeId,
          });
          const { changes } = yield* readChangeFingerprintsCapability.execute({
            worktreeId,
            comparisons: status.changes,
            paths: undefined,
          });
          const { texts } = yield* readTextFilesCapability.execute({
            worktreeId,
            paths: reviewPaths(input.layers, changes),
          });
          const diffs = yield* readChangeDiffsCapability.execute({
            worktreeId,
            comparisons: trackedComparisons(changes),
          });
          return { changes, texts, diffs };
        }),
      };
    }),
  );
}
