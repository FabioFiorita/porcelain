import { Effect, Layer, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { ReviewedLayerStore } from '@porcelain/reviews/ports';

import { ReviewedLayerRow } from '../../db/models/reviewed-layers.ts';

export const sqliteReviewedLayerStoreLayer = Layer.effect(
  ReviewedLayerStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const list = SqlSchema.findAll({
      Request: Schema.Struct({ worktreeId: Schema.String }),
      Result: Schema.Struct({
        layerId: ReviewedLayerRow.fields.layerId,
        fingerprint: ReviewedLayerRow.fields.fingerprint,
        reviewedAt: ReviewedLayerRow.fields.reviewedAt,
      }),
      execute: (input) =>
        sql`SELECT layer_id, fingerprint, reviewed_at FROM reviewed_layers WHERE worktree_id = ${input.worktreeId} ORDER BY reviewed_at, layer_id`,
    });
    const byWorktrees = SqlSchema.findAll({
      Request: Schema.Struct({ worktreeIds: Schema.Array(Schema.String) }),
      Result: ReviewedLayerRow,
      execute: (input) =>
        sql`SELECT * FROM reviewed_layers WHERE ${sql.in('worktreeId', input.worktreeIds)}`,
    });

    return ReviewedLayerStore.of({
      list: Effect.fn('ReviewedLayerStore.list')(function* (
        input: Parameters<ReviewedLayerStore['list']>[0],
      ) {
        return yield* list(input).pipe(Effect.orDie);
      }),
      byWorktrees: Effect.fn('ReviewedLayerStore.byWorktrees')(function* (
        input: Parameters<ReviewedLayerStore['byWorktrees']>[0],
      ) {
        return yield* byWorktrees(input).pipe(Effect.orDie);
      }),
      save: Effect.fn('ReviewedLayerStore.save')(function* (
        input: Parameters<ReviewedLayerStore['save']>[0],
      ) {
        return yield* Effect.gen(function* () {
          for (const mark of input.marks) {
            const row = { worktreeId: input.worktreeId, ...mark };
            yield* sql`INSERT INTO reviewed_layers ${sql.insert(row)} ON CONFLICT (worktree_id, layer_id) DO UPDATE SET ${sql.update(row, ['worktreeId', 'layerId'])}`;
          }
        }).pipe(sql.withTransaction, Effect.asVoid, Effect.orDie);
      }),
      remove: Effect.fn('ReviewedLayerStore.remove')(function* (
        input: Parameters<ReviewedLayerStore['remove']>[0],
      ) {
        yield* sql`DELETE FROM reviewed_layers WHERE worktree_id = ${input.worktreeId} AND layer_id = ${input.layerId}`.pipe(
          Effect.orDie,
        );
      }),
    });
  }),
);
