import { Effect, Layer, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { ReviewedLayerStore } from '@porcelain/reviews/ports';

import { ReviewedLayerRow } from '../../db/models/reviewed-layers.ts';

export const sqliteReviewedLayerStoreLayer = Layer.effect(
  ReviewedLayerStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const list = SqlSchema.findAll({
      Request: Schema.Struct({ reviewId: Schema.String }),
      Result: Schema.Struct({
        layerId: ReviewedLayerRow.fields.layerId,
        fingerprint: ReviewedLayerRow.fields.fingerprint,
        reviewedAt: ReviewedLayerRow.fields.reviewedAt,
      }),
      execute: (input) =>
        sql`SELECT layer_id, fingerprint, reviewed_at FROM reviewed_layers WHERE review_id = ${input.reviewId} ORDER BY reviewed_at, layer_id`,
    });
    return ReviewedLayerStore.of({
      list: Effect.fn('ReviewedLayerStore.list')(function* (
        input: Parameters<ReviewedLayerStore['list']>[0],
      ) {
        return yield* list(input).pipe(Effect.orDie);
      }),
      save: Effect.fn('ReviewedLayerStore.save')(function* (
        input: Parameters<ReviewedLayerStore['save']>[0],
      ) {
        return yield* Effect.gen(function* () {
          for (const mark of input.marks) {
            const row = { reviewId: input.reviewId, ...mark };
            yield* sql`INSERT INTO reviewed_layers ${sql.insert(row)} ON CONFLICT (review_id, layer_id, fingerprint) DO NOTHING`;
          }
        }).pipe(sql.withTransaction, Effect.asVoid, Effect.orDie);
      }),
      remove: Effect.fn('ReviewedLayerStore.remove')(function* (
        input: Parameters<ReviewedLayerStore['remove']>[0],
      ) {
        yield* sql`DELETE FROM reviewed_layers WHERE review_id = ${input.reviewId} AND layer_id = ${input.layerId} AND fingerprint = ${input.fingerprint}`.pipe(
          Effect.orDie,
        );
      }),
    });
  }),
);
