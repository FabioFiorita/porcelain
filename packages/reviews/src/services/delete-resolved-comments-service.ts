import { Effect, Context, Layer } from 'effect';
import {
  type DeleteResolvedCommentsInput,
  type DeleteResolvedCommentsResult,
} from '../models/delete-resolved-comments.ts';
import { CommentStore } from '../ports/comment-store.ts';
import {
  commentAuthor,
  unchangedResolvedThread,
} from '../rules/comment-threads.ts';

export class DeleteResolvedCommentsService extends Context.Service<
  DeleteResolvedCommentsService,
  {
    readonly execute: (
      input: DeleteResolvedCommentsInput,
    ) => Effect.Effect<DeleteResolvedCommentsResult, never>;
  }
>()('@porcelain/reviews/DeleteResolvedCommentsService') {
  static readonly layer = Layer.effect(
    DeleteResolvedCommentsService,
    Effect.gen(function* () {
      const commentsCapability = yield* CommentStore;

      return {
        execute: Effect.fn('DeleteResolvedCommentsService.execute')(function* (
          input: DeleteResolvedCommentsInput,
        ): Effect.fn.Return<DeleteResolvedCommentsResult, never> {
          return yield* Effect.sync<DeleteResolvedCommentsResult>(() => {
            const author = commentAuthor(input.writer);
            const deleted: string[] = [];
            const skipped: string[] = [];
            for (const confirmed of input.threads) {
              const thread = commentsCapability.find({
                threadId: confirmed.threadId,
              });
              if (
                thread !== undefined &&
                unchangedResolvedThread(thread, {
                  worktreeId: input.worktreeId,
                  revision: confirmed.revision,
                  author,
                })
              ) {
                commentsCapability.remove({ threadId: thread.id });
                deleted.push(thread.id);
              } else skipped.push(confirmed.threadId);
            }
            return { deleted, skipped };
          });
        }),
      };
    }),
  );
}
