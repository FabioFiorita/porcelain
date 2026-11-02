import { Effect, Layer, Option, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { AgentFeedbackStore } from '@porcelain/reviews/ports';
import { AgentFeedbackConflictError } from '@porcelain/reviews/errors';
import {
  reviewAgentFeedbackDeliverySchema,
  reviewAgentSessionSchema,
  type ReviewAgentFeedbackState,
} from '@porcelain/reviews/models';
import { ReviewAgentFeedbackRow } from '../../db/models/review-agent-feedback.ts';

export const sqliteAgentFeedbackStoreLayer = Layer.effect(
  AgentFeedbackStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const find = SqlSchema.findOneOption({
      Request: Schema.Struct({ reviewId: Schema.String }),
      Result: ReviewAgentFeedbackRow,
      execute: (input) =>
        sql`SELECT * FROM review_agent_feedback WHERE review_id = ${input.reviewId}`,
    });
    const read = Effect.fn('AgentFeedbackStore.read')(function* (input: {
      reviewId: string;
    }): Effect.fn.Return<ReviewAgentFeedbackState> {
      const row = yield* find(input).pipe(Effect.orDie);
      if (Option.isNone(row)) return {};
      return {
        session: row.value.session,
        ...(row.value.delivery === null
          ? {}
          : { delivery: row.value.delivery }),
      };
    });
    const current = Effect.fn('AgentFeedbackStore.current')(function* (input: {
      reviewId: string;
      deliveryId: string;
    }) {
      const state = yield* read(input);
      if (state.delivery?.id !== input.deliveryId) {
        return yield* new AgentFeedbackConflictError({
          reviewId: input.reviewId,
          reason: 'delivery-mismatch',
        });
      }
      return state;
    });
    const complete = Effect.fn('AgentFeedbackStore.complete')(function* (
      input: { reviewId: string; deliveryId: string },
      outcome: 'delivered' | 'acknowledged' | 'failed',
      error?: string,
    ) {
      return yield* Effect.gen(function* () {
        const state = yield* current(input);
        const delivery = state.delivery;
        if (
          !delivery ||
          delivery.state === 'acknowledged' ||
          (outcome === 'failed' && delivery.state === 'delivered')
        )
          return state;
        const updated = yield* Schema.encodeEffect(
          Schema.fromJsonString(reviewAgentFeedbackDeliverySchema),
        )({
          ...delivery,
          state: outcome === 'failed' ? 'pending' : outcome,
          attempted: true,
          error: outcome === 'failed' ? error : undefined,
        }).pipe(Effect.orDie);
        yield* sql`UPDATE review_agent_feedback SET delivery = ${updated} WHERE review_id = ${input.reviewId}`;
        return yield* read(input);
      }).pipe(sql.withTransaction, Effect.catchTag('SqlError', Effect.die));
    });

    return AgentFeedbackStore.of({
      read,
      connect: Effect.fn('AgentFeedbackStore.connect')(function* (input) {
        const session = yield* Schema.encodeEffect(
          Schema.fromJsonString(reviewAgentSessionSchema),
        )(input.session).pipe(Effect.orDie);
        return yield* Effect.gen(function* () {
          yield* sql`INSERT INTO review_agent_feedback (review_id, session, delivery) VALUES (${input.reviewId}, ${session}, NULL) ON CONFLICT (review_id) DO NOTHING`;
          const state = yield* read(input);
          if (state.session?.threadId !== input.session.threadId)
            return yield* new AgentFeedbackConflictError({
              reviewId: input.reviewId,
              reason: 'session-connected',
            });
          return state;
        }).pipe(sql.withTransaction, Effect.catchTag('SqlError', Effect.die));
      }),
      disconnect: Effect.fn('AgentFeedbackStore.disconnect')(function* (input) {
        yield* sql`DELETE FROM review_agent_feedback WHERE review_id = ${input.reviewId}`.pipe(
          Effect.orDie,
        );
        return {};
      }),
      enqueue: Effect.fn('AgentFeedbackStore.enqueue')(function* (input) {
        return yield* Effect.gen(function* () {
          const state = yield* read(input);
          if (!state.session)
            return yield* new AgentFeedbackConflictError({
              reviewId: input.reviewId,
              reason: 'session-missing',
            });
          const previous = state.delivery;
          if (
            previous?.reviewRevision === input.reviewRevision &&
            previous.commentRevision === input.commentRevision
          )
            return state;
          if (
            previous &&
            (previous.reviewRevision > input.reviewRevision ||
              previous.commentRevision > input.commentRevision ||
              previous.id === input.deliveryId)
          ) {
            return yield* new AgentFeedbackConflictError({
              reviewId: input.reviewId,
              reason: 'stale-feedback',
            });
          }
          if (previous?.state === 'pending' && previous.attempted) {
            return yield* new AgentFeedbackConflictError({
              reviewId: input.reviewId,
              reason: 'delivery-pending',
            });
          }
          const delivery = yield* Schema.encodeEffect(
            Schema.fromJsonString(reviewAgentFeedbackDeliverySchema),
          )({
            id: input.deliveryId,
            reviewId: input.reviewId,
            reviewRevision: input.reviewRevision,
            commentRevision: input.commentRevision,
            state: 'pending',
            attempted: false,
          }).pipe(Effect.orDie);
          yield* sql`UPDATE review_agent_feedback SET delivery = ${delivery} WHERE review_id = ${input.reviewId}`;
          return yield* read(input);
        }).pipe(sql.withTransaction, Effect.catchTag('SqlError', Effect.die));
      }),
      begin: Effect.fn('AgentFeedbackStore.begin')(function* (input) {
        return yield* Effect.gen(function* () {
          const rows =
            yield* sql`UPDATE review_agent_feedback SET delivery = json_set(delivery, '$.attempted', json('true')) WHERE review_id = ${input.reviewId} AND json_extract(delivery, '$.id') = ${input.deliveryId} AND json_extract(delivery, '$.state') = 'pending' AND json_extract(delivery, '$.attempted') = 0 RETURNING review_id`;
          if (rows.length === 1) return true;
          yield* current(input);
          return false;
        }).pipe(sql.withTransaction, Effect.catchTag('SqlError', Effect.die));
      }),
      delivered: Effect.fn('AgentFeedbackStore.delivered')((input) =>
        complete(input, 'delivered'),
      ),
      failed: Effect.fn('AgentFeedbackStore.failed')((input) =>
        complete(input, 'failed', input.error),
      ),
      acknowledge: Effect.fn('AgentFeedbackStore.acknowledge')(
        function* (input) {
          return yield* Effect.gen(function* () {
            const feedback = yield* current(input);
            if (feedback.delivery?.state === 'acknowledged')
              return { feedback, accepted: false };
            return {
              feedback: yield* complete(input, 'acknowledged'),
              accepted: true,
            };
          }).pipe(sql.withTransaction, Effect.catchTag('SqlError', Effect.die));
        },
      ),
    });
  }),
);
