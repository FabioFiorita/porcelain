import { Context, Effect, Layer } from 'effect';
import { IdSource } from '@porcelain/kernel/ports';
import type {
  ReviewAgentFeedbackOperation,
  ReviewAgentFeedbackResponse,
} from '../models/agent-feedback.ts';
import { AgentFeedbackConflictError } from '../errors/agent-feedback-conflict-error.ts';
import type { ReviewNotFoundError } from '../errors/review-not-found-error.ts';
import { AgentFeedbackStore } from '../ports/agent-feedback-store.ts';
import { CommentStore } from '../ports/comment-store.ts';
import { ReviewAgentHost } from '../ports/review-agent-host.ts';
import { ReadReviewRecordService } from './read-review-record-service.ts';
import { ReadReviewRevisionService } from './read-review-revision-service.ts';

export class AgentFeedbackService extends Context.Service<
  AgentFeedbackService,
  {
    readonly execute: (
      input: ReviewAgentFeedbackOperation,
    ) => Effect.Effect<
      { feedback: ReviewAgentFeedbackResponse; worktreeId: string },
      ReviewNotFoundError | AgentFeedbackConflictError
    >;
  }
>()('@porcelain/reviews/AgentFeedbackService') {
  static readonly layer = Layer.effect(
    AgentFeedbackService,
    Effect.gen(function* () {
      const reviews = yield* ReadReviewRevisionService;
      const records = yield* ReadReviewRecordService;
      const feedback = yield* AgentFeedbackStore;
      const comments = yield* CommentStore;
      const host = yield* ReviewAgentHost;
      const ids = yield* IdSource;
      return {
        execute: Effect.fn('AgentFeedbackService.execute')(function* (input) {
          const review = yield* reviews.execute({
            reviewId: input.reviewId,
          });
          const key = { reviewId: review.reviewId };
          if (input.kind === 'send' || input.kind === 'connect') {
            const record = yield* records.execute(key);
            if (record.state !== 'open' || record.archived)
              return yield* new AgentFeedbackConflictError({
                ...key,
                reason: 'review-inactive',
              });
          }
          if (input.kind === 'connect') {
            yield* host.execute({
              ...key,
              kind: 'verify',
              session: input.session,
              worktreePath: review.worktreePath,
            });
            yield* feedback.connect({ ...key, session: input.session });
          }
          if (input.kind === 'disconnect') yield* feedback.disconnect(key);
          const acknowledgement =
            input.kind === 'acknowledge'
              ? yield* feedback.acknowledge({
                  ...key,
                  deliveryId: input.deliveryId,
                })
              : undefined;
          if (input.kind === 'send') {
            if (input.reviewRevision !== review.revision)
              return yield* new AgentFeedbackConflictError({
                ...key,
                reason: 'stale-feedback',
              });
            const current = yield* feedback.read(key);
            if (current.session === undefined)
              return yield* new AgentFeedbackConflictError({
                ...key,
                reason: 'session-missing',
              });
            const commentRevision = yield* comments.lastRevision({
              reviewId: review.reviewId,
            });
            const queued = yield* feedback.enqueue({
              ...key,
              reviewRevision: review.revision,
              commentRevision,
              deliveryId: ids.next(),
            });
            const delivery = queued.delivery;
            if (
              delivery !== undefined &&
              (yield* feedback.begin({ ...key, deliveryId: delivery.id }))
            ) {
              const attempt = { ...key, deliveryId: delivery.id };
              yield* host
                .execute({
                  ...key,
                  kind: 'send',
                  session: current.session,
                  worktreePath: review.worktreePath,
                  message: `Porcelain feedback is ready. Delivery ${delivery.id}; review ${review.reviewId}; revision ${review.revision}; comment watermark ${commentRevision}. Use acknowledge_feedback with reviewId and deliveryId before handling this batch. If already acknowledged, do not repeat work. Read read_review at revision ${review.revision} and list_comments for this review, then respond with reply_to_comment using stable message IDs. This is feedback readiness, not permission to implement, merge, publish, or expand the owner's scope. Follow the existing session authorization.`,
                })
                .pipe(
                  Effect.andThen(feedback.delivered(attempt)),
                  Effect.catch(() =>
                    feedback.failed({
                      ...attempt,
                      error:
                        'Delivery could not be confirmed. It will not be sent again automatically.',
                    }),
                  ),
                );
            }
          }
          return {
            worktreeId: review.worktreeId,
            feedback: {
              ...(yield* feedback.read(key)),
              ...(acknowledgement === undefined
                ? {}
                : { acknowledgementAccepted: acknowledgement.accepted }),
              currentCommentRevision: yield* comments.lastRevision(key),
            },
          };
        }),
      };
    }),
  );
}
