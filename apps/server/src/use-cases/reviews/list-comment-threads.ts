import { Context, Effect, Layer } from 'effect';
import type {
  ListCommentThreadsQuery,
  ListCommentThreadsResponse,
  ReviewScope,
} from '@porcelain/contracts/reviews';
import {
  ListCommentThreadsService,
  ReadPublishedReviewService,
  ReadReviewRevisionService,
} from '@porcelain/reviews/services';
import type { ReviewNotFoundError } from '@porcelain/reviews/errors';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';

export class ListCommentThreadsUseCase extends Context.Service<
  ListCommentThreadsUseCase,
  {
    readonly execute: (
      input: ReviewScope & ListCommentThreadsQuery,
    ) => Effect.Effect<
      ListCommentThreadsResponse,
      WorktreeAccessFailure | ReviewNotFoundError
    >;
  }
>()('@porcelain/server/ListCommentThreadsUseCase') {
  static readonly layer = Layer.effect(
    ListCommentThreadsUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const operation = yield* ListCommentThreadsService;
      const branches = yield* ReadPublishedReviewService;
      const revisions = yield* ReadReviewRevisionService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      return {
        execute: Effect.fn('ListCommentThreadsUseCase.execute')(
          function* (input) {
            if (input.reviewId !== undefined)
              return yield* lanes.run(
                keys.reviews({ repositoryId: `review:${input.reviewId}` }),
                'read',
                () =>
                  Effect.gen(function* () {
                    const review = yield* revisions.execute({
                      reviewId: input.reviewId ?? '',
                    });
                    return yield* operation.execute({
                      reviewId: review.reviewId,
                      scope: input.scope,
                    });
                  }),
              );
            const worktreeId = input.worktreeId ?? '';
            return yield* access.reviews(worktreeId, 'read', () =>
              Effect.gen(function* () {
                const branch = yield* branches.execute({ worktreeId });
                return yield* operation.execute({
                  scope: input.scope,
                  worktreeId,
                  reviewId:
                    branch.kind === 'none' ? undefined : branch.review.reviewId,
                });
              }),
            );
          },
        ),
      };
    }),
  );
}
