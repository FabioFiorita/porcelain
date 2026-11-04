import { ReadRetainedBranchDiffsService } from '@porcelain/changes/services';
import { ReadReviewTextsService } from '@porcelain/reviews/services';
import {
  type IncompleteDiffReadError,
  type CommitNotFoundError,
} from '@porcelain/changes/errors';
import {
  type ReadReviewEvidenceInput,
  type ReviewEvidence,
} from '@porcelain/reviews/models';
import { reviewPaths } from '@porcelain/reviews/rules';
import { Effect, Context, Layer } from 'effect';
import { type WorktreeRead } from '@porcelain/effects';
import { type GitIoFailure } from '@porcelain/git/errors';

export class ReadReviewEvidenceUseCase extends Context.Service<
  ReadReviewEvidenceUseCase,
  {
    readonly execute: (
      input: ReadReviewEvidenceInput,
    ) => Effect.Effect<
      ReviewEvidence,
      GitIoFailure | IncompleteDiffReadError | CommitNotFoundError,
      WorktreeRead
    >;
  }
>()('@porcelain/server/ReadReviewEvidenceUseCase') {
  static readonly layer = Layer.effect(
    ReadReviewEvidenceUseCase,
    Effect.gen(function* () {
      const branches = yield* ReadRetainedBranchDiffsService;
      const code = yield* ReadReviewTextsService;

      return {
        execute: Effect.fn('ReadReviewEvidenceUseCase.execute')(function* (
          input: ReadReviewEvidenceInput,
        ): Effect.fn.Return<
          ReviewEvidence,
          GitIoFailure | IncompleteDiffReadError | CommitNotFoundError,
          WorktreeRead
        > {
          const revision = input.revision;
          const changes = revision.files.map((file) => ({
            path: file.path,
            fingerprint: file.newOid,
            comparisons: [
              {
                scope: 'staged' as const,
                kind: file.status,
                oldPath: file.oldPath,
                newPath: file.newPath,
                oldMode: file.oldMode,
                newMode: file.newMode,
                oldOid: file.oldOid,
                newOid: file.newOid,
                supported: true,
              },
            ],
          }));
          const { texts, missing } = yield* code.execute({
            commonDirectory: revision.commonDirectory,
            oid: revision.headOid,
            paths: reviewPaths(input.layers, changes),
          });
          const paths = revision.files.map((file) => [
            ...new Set(
              [file.oldPath, file.newPath].filter((path) => path !== undefined),
            ),
          ]);
          const patches =
            paths.length === 0
              ? { diffs: [] }
              : yield* branches.execute({
                  commonDirectory: revision.commonDirectory,
                  baseOid: revision.mergeBaseOid,
                  headOid: revision.headOid,
                  paths,
                });
          const diffs = revision.files.map((file, index) => ({
            selection: {
              scope: 'staged' as const,
              oldPath: file.oldPath,
              newPath: file.newPath,
            },
            content: patches.diffs[index]?.content ?? {
              kind: 'omitted' as const,
              reason: 'size-limit' as const,
            },
          }));
          return { headOid: revision.headOid, changes, texts, missing, diffs };
        }),
      };
    }),
  );
}
