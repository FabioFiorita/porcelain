import { Effect, Context, Layer } from 'effect';
import {
  type MarkCommentsSeenInput,
  type MarkCommentsSeenResult,
} from '../models/mark-comments-seen.ts';
import { CommentSeenStore } from '../ports/comment-seen-store.ts';
import { CommentStore } from '../ports/comment-store.ts';
import { seenThrough } from '../rules/comment-threads.ts';

export class MarkCommentsSeenService extends Context.Service<
  MarkCommentsSeenService,
  {
    readonly execute: (
      input: MarkCommentsSeenInput,
    ) => Effect.Effect<MarkCommentsSeenResult, never>;
  }
>()('@porcelain/reviews/MarkCommentsSeenService') {
  static readonly layer = Layer.effect(
    MarkCommentsSeenService,
    Effect.gen(function* () {
      const commentSeenCapability = yield* CommentSeenStore;
      const commentsCapability = yield* CommentStore;

      return {
        execute: Effect.fn('MarkCommentsSeenService.execute')(function* (
          input: MarkCommentsSeenInput,
        ): Effect.fn.Return<MarkCommentsSeenResult, never> {
          return yield* Effect.sync<MarkCommentsSeenResult>(() => {
            const { worktreeId } = input;
            const before = commentSeenCapability.seenThrough({ worktreeId });
            const seen = seenThrough(
              before,
              input.throughRevision,
              commentsCapability.lastRevision({ worktreeId }),
            );
            if (seen === before)
              return { worktreeId, seenThrough: seen, changed: false };
            commentSeenCapability.save({ worktreeId, seenThrough: seen });
            return { worktreeId, seenThrough: seen, changed: true };
          });
        }),
      };
    }),
  );
}
