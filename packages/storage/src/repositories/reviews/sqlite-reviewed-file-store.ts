import { Effect, Layer, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { ReviewedFileStore } from '@porcelain/reviews/ports';

import { ReviewedFileRow } from '../../db/models/reviewed-files.ts';

export const sqliteReviewedFileStoreLayer = Layer.effect(
  ReviewedFileStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const list = SqlSchema.findAll({
      Request: Schema.Struct({
        worktreeId: Schema.String,
        scope: Schema.optional(Schema.Literals(['worktree', 'branch'])),
        branch: Schema.optional(Schema.String),
      }),
      Result: Schema.Struct({
        path: ReviewedFileRow.fields.path,
        fingerprint: ReviewedFileRow.fields.fingerprint,
        reviewedAt: ReviewedFileRow.fields.reviewedAt,
        stale: ReviewedFileRow.fields.stale,
      }),
      execute: (input) =>
        sql`SELECT path, fingerprint, reviewed_at, stale FROM reviewed_files WHERE worktree_id = ${input.worktreeId} AND scope = ${input.scope ?? 'worktree'} AND branch = ${input.branch ?? ''} ORDER BY path`,
    });

    return ReviewedFileStore.of({
      list: Effect.fn('ReviewedFileStore.list')(function* (
        input: Parameters<ReviewedFileStore['list']>[0],
      ) {
        return yield* list(input).pipe(Effect.orDie);
      }),
      save: Effect.fn('ReviewedFileStore.save')(function* (
        input: Parameters<ReviewedFileStore['save']>[0],
      ) {
        return yield* Effect.gen(function* () {
          for (const mark of input.marks) {
            const row = yield* Schema.encodeEffect(ReviewedFileRow.insert)({
              worktreeId: input.worktreeId,
              scope: input.scope ?? 'worktree',
              branch: input.branch ?? '',
              ...mark,
            });
            yield* sql`INSERT INTO reviewed_files ${sql.insert(row)} ON CONFLICT (worktree_id, scope, branch, path) DO UPDATE SET ${sql.update(row, ['worktreeId', 'scope', 'branch', 'path'])}`;
          }
        }).pipe(sql.withTransaction, Effect.asVoid, Effect.orDie);
      }),
      remove: Effect.fn('ReviewedFileStore.remove')(function* (
        input: Parameters<ReviewedFileStore['remove']>[0],
      ) {
        if (!input.paths.length) return;
        yield* sql`DELETE FROM reviewed_files WHERE worktree_id = ${input.worktreeId} AND scope = ${input.scope ?? 'worktree'} AND branch = ${input.branch ?? ''} AND ${sql.in('path', input.paths)}`.pipe(
          Effect.orDie,
        );
      }),
      setStale: Effect.fn('ReviewedFileStore.setStale')(function* (
        input: Parameters<ReviewedFileStore['setStale']>[0],
      ) {
        if (!input.paths.length) return;
        yield* sql`UPDATE reviewed_files SET stale = ${input.stale ? 1 : 0} WHERE worktree_id = ${input.worktreeId} AND scope = ${input.scope ?? 'worktree'} AND branch = ${input.branch ?? ''} AND ${sql.in('path', input.paths)}`.pipe(
          Effect.orDie,
        );
      }),
    });
  }),
);
