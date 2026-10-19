import { Context, Effect, Layer } from 'effect';
import { ReadReviewRevisionService } from '@porcelain/reviews/services';
import { ReadRetainedBranchDiffsService } from '@porcelain/changes/services';
import type { GitIoFailure } from '@porcelain/git/errors';
import type {
  CommitNotFoundError,
  IncompleteDiffReadError,
} from '@porcelain/changes/errors';
import type { ReadBranchDiffsResponse } from '@porcelain/contracts/changes';
import type { ReviewNotFoundError } from '@porcelain/reviews/errors';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';

export class ReadReviewDiffsUseCase extends Context.Service<
  ReadReviewDiffsUseCase,
  {
    readonly execute: (input: {
      reviewId: string;
      revision: number;
      paths: readonly (readonly string[])[];
    }) => Effect.Effect<
      ReadBranchDiffsResponse,
      | ReviewNotFoundError
      | GitIoFailure
      | CommitNotFoundError
      | IncompleteDiffReadError
    >;
  }
>()('@porcelain/server/ReadReviewDiffsUseCase') {
  static readonly layer = Layer.effect(
    ReadReviewDiffsUseCase,
    Effect.gen(function* () {
      const revisions = yield* ReadReviewRevisionService;
      const diffs = yield* ReadRetainedBranchDiffsService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      return {
        execute: Effect.fn('ReadReviewDiffsUseCase.execute')(function* (input) {
          const review = yield* lanes.run(
            keys.reviews({ repositoryId: `review:${input.reviewId}` }),
            'read',
            () => revisions.execute(input),
          );
          return yield* diffs.execute({
            commonDirectory: review.commonDirectory,
            baseOid: review.mergeBaseOid,
            headOid: review.headOid,
            paths: input.paths,
          });
        }),
      };
    }),
  );
}
