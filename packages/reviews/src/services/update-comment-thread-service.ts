import { Effect, Context, Layer } from 'effect';
import { CommentTargetNotFoundError } from '../errors/comment-target-not-found-error.ts';
import {
  type UpdateCommentThreadInput,
  type UpdateCommentThreadResult,
} from '../models/update-comment-thread.ts';
import { CommentStore } from '../ports/comment-store.ts';

export class UpdateCommentThreadService extends Context.Service<
  UpdateCommentThreadService,
  {
    readonly execute: (
      input: UpdateCommentThreadInput,
    ) => Effect.Effect<UpdateCommentThreadResult, CommentTargetNotFoundError>;
  }
>()('@porcelain/reviews/UpdateCommentThreadService') {
  static readonly layer = Layer.effect(
    UpdateCommentThreadService,
    Effect.gen(function* () {
      const commentsCapability = yield* CommentStore;

      return {
        execute: Effect.fn('UpdateCommentThreadService.execute')(function* (
          input: UpdateCommentThreadInput,
        ): Effect.fn.Return<
          UpdateCommentThreadResult,
          CommentTargetNotFoundError
        > {
          const current = yield* commentsCapability.find({
            threadId: input.threadId,
          });
          if (!current || current.worktreeId !== input.worktreeId)
            return yield* Effect.fail(new CommentTargetNotFoundError());
          if (current.resolved === input.resolved)
            return { thread: current, changed: false };
          return {
            thread: yield* commentsCapability.resolve({
              thread: current,
              resolved: input.resolved,
            }),
            changed: true,
          };
        }),
      };
    }),
  );
}
