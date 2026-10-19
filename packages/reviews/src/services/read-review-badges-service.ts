import { Effect, Context, Layer } from 'effect';
import {
  type ReadReviewBadgesInput,
  type ReadReviewBadgesResult,
} from '../models/read-review-badges.ts';
import { CommentSeenStore } from '../ports/comment-seen-store.ts';
import { CommentStore } from '../ports/comment-store.ts';
import { BranchReviewReader } from '../ports/branch-review-reader.ts';
import { ReviewedLayerStore } from '../ports/reviewed-layer-store.ts';
import { worktreeStatuses } from '../rules/worktree-statuses.ts';

export class ReadReviewBadgesService extends Context.Service<
  ReadReviewBadgesService,
  {
    readonly execute: (
      input: ReadReviewBadgesInput,
    ) => Effect.Effect<ReadReviewBadgesResult, never>;
  }
>()('@porcelain/reviews/ReadReviewBadgesService') {
  static readonly layer = Layer.effect(
    ReadReviewBadgesService,
    Effect.gen(function* () {
      const reviewsCapability = yield* BranchReviewReader;
      const reviewedLayersCapability = yield* ReviewedLayerStore;
      const commentsCapability = yield* CommentStore;
      const commentSeenCapability = yield* CommentSeenStore;

      return {
        execute: Effect.fn('ReadReviewBadgesService.execute')(function* (
          input: ReadReviewBadgesInput,
        ): Effect.fn.Return<ReadReviewBadgesResult, never> {
          const { worktreeIds } = input;
          const reviews = yield* reviewsCapability.byWorktrees({ worktreeIds });
          const marks = (yield* Effect.forEach(reviews, (review) =>
            Effect.map(
              reviewedLayersCapability.list({ reviewId: review.reviewId }),
              (marks) =>
                marks.map((mark) => ({
                  ...mark,
                  worktreeId: review.worktreeId,
                })),
            ),
          )).flat();
          return {
            statuses: worktreeStatuses(
              reviews,
              marks,
              yield* commentsCapability.listAgentReplies({ worktreeIds }),
              yield* commentSeenCapability.seenByWorktrees({ worktreeIds }),
            ),
          };
        }),
      };
    }),
  );
}
