import { Effect, Layer, Option, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { ReviewStore } from '@porcelain/reviews/ports';

import { ReviewRow } from '../../db/models/reviews.ts';
import { ProofFileRow } from '../../db/models/review-proof-files.ts';

function reviewFromRow({ diagram, proof, ...review }: ReviewRow) {
  return {
    ...review,
    ...(diagram === null ? {} : { diagram }),
    ...(proof === null ? {} : { proof }),
  };
}
export const sqliteReviewStoreLayer = Layer.effect(
  ReviewStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const read = SqlSchema.findOneOption({
      Request: Schema.Struct({ worktreeId: Schema.String }),
      Result: ReviewRow,
      execute: (input) =>
        sql`SELECT * FROM reviews WHERE worktree_id = ${input.worktreeId}`,
    });
    const byWorktrees = SqlSchema.findAll({
      Request: Schema.Struct({ worktreeIds: Schema.Array(Schema.String) }),
      Result: ReviewRow,
      execute: (input) =>
        sql`SELECT * FROM reviews WHERE ${sql.in('worktreeId', input.worktreeIds)}`,
    });
    const summary = SqlSchema.findOneOption({
      Request: Schema.Struct({ token: Schema.String }),
      Result: Schema.Struct({
        summaryHtml: Schema.String,
        summaryToken: Schema.String,
        summarySecret: Schema.String,
      }),
      execute: (input) =>
        sql`SELECT summary_html, summary_token, summary_secret FROM reviews WHERE summary_token = ${input.token}`,
    });
    const proofFile = SqlSchema.findOneOption({
      Request: Schema.Struct({
        worktreeId: Schema.String,
        proofId: Schema.String,
      }),
      Result: Schema.Struct({
        id: ProofFileRow.fields.id,
        mediaType: ProofFileRow.fields.mediaType,
        bytes: ProofFileRow.fields.bytes,
      }),
      execute: (input) =>
        sql`SELECT id, media_type, bytes FROM review_proof_files WHERE worktree_id = ${input.worktreeId} AND id = ${input.proofId}`,
    });

    return ReviewStore.of({
      read: Effect.fn('ReviewStore.read')(function* (
        input: Parameters<ReviewStore['read']>[0],
      ) {
        return Option.getOrUndefined(
          Option.map(yield* read(input).pipe(Effect.orDie), reviewFromRow),
        );
      }),
      byWorktrees: Effect.fn('ReviewStore.byWorktrees')(function* (
        input: Parameters<ReviewStore['byWorktrees']>[0],
      ) {
        return (yield* byWorktrees(input).pipe(Effect.orDie)).map(
          reviewFromRow,
        );
      }),
      findSummary: Effect.fn('ReviewStore.findSummary')(function* (
        input: Parameters<ReviewStore['findSummary']>[0],
      ) {
        return Option.getOrUndefined(yield* summary(input).pipe(Effect.orDie));
      }),
      readProofFile: Effect.fn('ReviewStore.readProofFile')(function* (
        input: Parameters<ReviewStore['readProofFile']>[0],
      ) {
        return Option.getOrUndefined(
          Option.map(yield* proofFile(input).pipe(Effect.orDie), (row) => ({
            ...row,
            bytes: Uint8Array.from(row.bytes),
          })),
        );
      }),
      save: Effect.fn('ReviewStore.save')(function* (
        input: Parameters<ReviewStore['save']>[0],
      ) {
        return yield* Effect.gen(function* () {
          const { proofFiles, ...review } = input;
          const row = yield* Schema.encodeEffect(ReviewRow.insert)({
            ...review,
            diagram: review.diagram ?? null,
            proof: review.proof ?? null,
          });
          yield* sql`INSERT INTO reviews ${sql.insert(row)} ON CONFLICT (worktree_id) DO UPDATE SET ${sql.update(row, ['worktreeId'])}`;
          yield* sql`DELETE FROM review_proof_files WHERE worktree_id = ${review.worktreeId}`;
          for (const file of proofFiles ?? []) {
            yield* sql`INSERT INTO review_proof_files ${sql.insert({ worktreeId: review.worktreeId, id: file.id, mediaType: file.mediaType, bytes: Uint8Array.from(file.bytes) })}`;
          }
        }).pipe(sql.withTransaction, Effect.asVoid, Effect.orDie);
      }),
      setActive: Effect.fn('ReviewStore.setActive')(function* (
        input: Parameters<ReviewStore['setActive']>[0],
      ) {
        yield* sql`UPDATE reviews SET active = ${input.active ? 1 : 0} WHERE worktree_id = ${input.worktreeId} AND revision = ${input.revision}`.pipe(
          Effect.orDie,
        );
      }),
    });
  }),
);
