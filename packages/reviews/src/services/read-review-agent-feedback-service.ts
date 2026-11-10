import { Context, Effect, Layer } from 'effect';
import type { ReviewAgentFeedbackState } from '../models/agent-feedback.ts';
import { ReviewNotFoundError } from '../errors/review-not-found-error.ts';
import { AgentFeedbackStore } from '../ports/agent-feedback-store.ts';
import { CommentStore } from '../ports/comment-store.ts';
import { ReviewStore } from '../ports/review-store.ts';

export class ReadReviewAgentFeedbackService extends Context.Service<
  ReadReviewAgentFeedbackService,
  {
    readonly execute: (input: {
      reviewId: string;
    }) => Effect.Effect<
      ReviewAgentFeedbackState & { currentCommentRevision: number },
      ReviewNotFoundError
    >;
  }
>()('@porcelain/reviews/ReadReviewAgentFeedbackService') {
  static readonly layer = Layer.effect(
    ReadReviewAgentFeedbackService,
    Effect.gen(function* () {
      const reviews = yield* ReviewStore;
      const feedback = yield* AgentFeedbackStore;
      const comments = yield* CommentStore;
      return {
        execute: Effect.fn('ReadReviewAgentFeedbackService.execute')(
          function* (input) {
            if ((yield* reviews.readRecord(input)) === undefined)
              return yield* new ReviewNotFoundError();
            return {
              ...(yield* feedback.read(input)),
              currentCommentRevision: yield* comments.lastRevision(input),
            };
          },
        ),
      };
    }),
  );
}
