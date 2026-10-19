import { Context, Effect, Layer } from 'effect';
import { SelectReviewComparisonService } from '@porcelain/reviews/services';
import type { CompareReviewInput } from '@porcelain/reviews/models';
import { ReadRetainedBranchDiffsService } from '@porcelain/changes/services';
import type { GitIoFailure } from '@porcelain/git/errors';
import type {
  IncompleteDiffReadError,
  CommitNotFoundError,
} from '@porcelain/changes/errors';
import type {
  ReviewNotFoundError,
  InvalidReviewComparisonError,
} from '@porcelain/reviews/errors';
import type { ReadReviewInterdiffResponse } from '@porcelain/contracts/reviews';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';

export class ReadReviewInterdiffUseCase extends Context.Service<
  ReadReviewInterdiffUseCase,
  {
    readonly execute: (
      input: CompareReviewInput & { path: string },
    ) => Effect.Effect<
      ReadReviewInterdiffResponse,
      | ReviewNotFoundError
      | InvalidReviewComparisonError
      | GitIoFailure
      | CommitNotFoundError
      | IncompleteDiffReadError
    >;
  }
>()('@porcelain/server/ReadReviewInterdiffUseCase') {
  static readonly layer = Layer.effect(
    ReadReviewInterdiffUseCase,
    Effect.gen(function* () {
      const select = yield* SelectReviewComparisonService;
      const diffs = yield* ReadRetainedBranchDiffsService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      return {
        execute: Effect.fn('ReadReviewInterdiffUseCase.execute')(
          function* (input) {
            const { from, to } = yield* lanes.run(
              keys.reviews({ repositoryId: `review:${input.reviewId}` }),
              'read',
              () => select.execute(input),
            );
            if (from === undefined)
              return { kind: 'unavailable', reason: 'no-baseline' };
            const old = from.files.find((file) => file.path === input.path);
            const next = to.files.find((file) => file.path === input.path);
            if (old === undefined || next === undefined)
              return { kind: 'unavailable', reason: 'path-not-reviewed' };
            if (old.newOid === next.newOid && old.oldOid === next.oldOid)
              return { kind: 'unavailable', reason: 'not-changed' };
            if (old.newOid === undefined || next.newOid === undefined)
              return { kind: 'unavailable', reason: 'missing-head-blob' };
            const answer = yield* diffs.execute({
              commonDirectory: to.commonDirectory,
              baseOid: from.headOid,
              headOid: to.headOid,
              paths: [[input.path]],
            });
            return {
              kind: 'diff',
              from: from.revision,
              to: to.revision,
              path: input.path,
              diffs: answer.diffs,
            };
          },
        ),
      };
    }),
  );
}
