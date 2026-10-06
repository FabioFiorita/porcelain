import { Effect, Context, Layer } from 'effect';
import {
  type ReadReviewBadgesInput,
  type ReadReviewBadgesResult,
} from '../models/read-review-badges.ts';
import { CommentSeenStore } from '../ports/comment-seen-store.ts';
import { CommentStore } from '../ports/comment-store.ts';
import { ReviewStore } from '../ports/review-store.ts';
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
      const reviewsCapability = yield* ReviewStore;
      const reviewedLayersCapability = yield* ReviewedLayerStore;
      const commentsCapability = yield* CommentStore;
      const commentSeenCapability = yield* CommentSeenStore;

      return {
        execute: Effect.fn('ReadReviewBadgesService.execute')(function* (
          input: ReadReviewBadgesInput,
        ): Effect.fn.Return<ReadReviewBadgesResult, never> {
          const { worktreeIds } = input;
          return {
            statuses: worktreeStatuses(
              yield* reviewsCapability.byWorktrees({ worktreeIds }),
              yield* reviewedLayersCapability.byWorktrees({ worktreeIds }),
              yield* commentsCapability.listAgentReplies({ worktreeIds }),
              yield* commentSeenCapability.seenByWorktrees({ worktreeIds }),
              input.texts,
            ),
          };
        }),
      };
    }),
  );
}
