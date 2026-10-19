import { Effect, Context, Layer } from 'effect';
import {
  type ListCommentThreadsInput,
  type ListCommentThreadsResult,
} from '../models/list-comment-threads.ts';
import { CommentStore } from '../ports/comment-store.ts';
import { waitsForAgent } from '../rules/comment-threads.ts';

export class ListCommentThreadsService extends Context.Service<
  ListCommentThreadsService,
  {
    readonly execute: (
      input: ListCommentThreadsInput,
    ) => Effect.Effect<ListCommentThreadsResult, never>;
  }
>()('@porcelain/reviews/ListCommentThreadsService') {
  static readonly layer = Layer.effect(
    ListCommentThreadsService,
    Effect.gen(function* () {
      const commentsCapability = yield* CommentStore;

      return {
        execute: Effect.fn('ListCommentThreadsService.execute')(function* (
          input: ListCommentThreadsInput,
        ): Effect.fn.Return<ListCommentThreadsResult, never> {
          const worktreeThreads =
            input.worktreeId === undefined
              ? []
              : yield* commentsCapability.list({
                  worktreeId: input.worktreeId,
                });
          const reviewThreads =
            input.reviewId === undefined
              ? []
              : yield* commentsCapability.list({ reviewId: input.reviewId });
          const threads = [...worktreeThreads, ...reviewThreads];
          return input.scope === 'waiting'
            ? threads.filter(waitsForAgent)
            : threads;
        }),
      };
    }),
  );
}
