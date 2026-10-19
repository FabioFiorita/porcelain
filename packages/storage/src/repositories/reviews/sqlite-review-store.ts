import {
  openReviewForKey,
  reviewPullRequestNumber,
} from '@porcelain/reviews/rules';
import { Effect, Layer, Option, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { ReviewStore } from '@porcelain/reviews/ports';
import { ReviewConflictError } from '@porcelain/reviews/errors';
import { ReviewRow, ReviewRecordRow } from '../../db/models/reviews.ts';
import { ProofFileRow } from '../../db/models/review-proof-files.ts';

function reviewFromRow({ diagram, proof, ...review }: ReviewRow) {
  return {
    ...review,
    ...(diagram === null ? {} : { diagram }),
    ...(proof === null ? {} : { proof }),
  };
}
function recordFromRow({
  pullRequest,
  pullRequestNumber: _,
  ...record
}: ReviewRecordRow & { lastSeenRevision: number }) {
  return { ...record, ...(pullRequest === null ? {} : { pullRequest }) };
}
export const sqliteReviewStoreLayer = Layer.effect(
  ReviewStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const record = SqlSchema.findOneOption({
      Request: Schema.Struct({ reviewId: Schema.String }),
      Result: Schema.Struct({
        ...ReviewRecordRow.fields,
        lastSeenRevision: Schema.Int,
      }),
      execute: (input) =>
        sql`SELECT r.*, COALESCE(s.last_seen_revision, 0) AS last_seen_revision FROM reviews r LEFT JOIN review_seen s ON s.review_id = r.review_id WHERE r.review_id = ${input.reviewId}`,
    });
    const read = SqlSchema.findOneOption({
      Request: Schema.Struct({
        reviewId: Schema.String,
        revision: Schema.optional(Schema.Number),
      }),
      Result: ReviewRow,
      execute: (input) =>
        input.revision === undefined
          ? sql`SELECT r.* FROM review_revisions r JOIN reviews v ON v.review_id = r.review_id AND v.latest_revision = r.revision WHERE r.review_id = ${input.reviewId}`
          : sql`SELECT * FROM review_revisions WHERE review_id = ${input.reviewId} AND revision = ${input.revision}`,
    });
    const revisions = SqlSchema.findAll({
      Request: Schema.Struct({ reviewId: Schema.String }),
      Result: ReviewRow,
      execute: (input) =>
        sql`SELECT * FROM review_revisions WHERE review_id = ${input.reviewId} ORDER BY revision`,
    });
    const list = SqlSchema.findAll({
      Request: Schema.Struct({ projectId: Schema.String }),
      Result: Schema.Struct({
        ...ReviewRecordRow.fields,
        lastSeenRevision: Schema.Int,
      }),
      execute: (input) =>
        sql`SELECT r.*, COALESCE(s.last_seen_revision, 0) AS last_seen_revision FROM reviews r LEFT JOIN review_seen s ON s.review_id = r.review_id WHERE r.project_id = ${input.projectId} ORDER BY r.rowid DESC`,
    });
    const summary = SqlSchema.findOneOption({
      Request: Schema.Struct({ token: Schema.String }),
      Result: Schema.Struct({
        summaryHtml: Schema.String,
        summaryToken: Schema.String,
        summarySecret: Schema.String,
      }),
      execute: (input) =>
        sql`SELECT summary_html, summary_token, summary_secret FROM review_revisions WHERE summary_token = ${input.token}`,
    });
    const proofFile = SqlSchema.findOneOption({
      Request: Schema.Struct({
        reviewId: Schema.String,
        revision: Schema.optional(Schema.Number),
        proofId: Schema.String,
      }),
      Result: Schema.Struct({
        id: ProofFileRow.fields.id,
        mediaType: ProofFileRow.fields.mediaType,
        bytes: ProofFileRow.fields.bytes,
      }),
      execute: (input) =>
        sql`SELECT id, media_type, bytes FROM review_proof_files WHERE review_id = ${input.reviewId} AND id = ${input.proofId} AND ${input.revision === undefined ? sql`1 = 1` : sql`revision = ${input.revision}`} ORDER BY revision DESC LIMIT 1`,
    });
    return ReviewStore.of({
      read: Effect.fn('ReviewStore.read')(function* (input) {
        return Option.getOrUndefined(
          Option.map(yield* read(input).pipe(Effect.orDie), reviewFromRow),
        );
      }),
      readRecord: Effect.fn('ReviewStore.readRecord')(function* (input) {
        return Option.getOrUndefined(
          Option.map(yield* record(input).pipe(Effect.orDie), recordFromRow),
        );
      }),
      findOpen: Effect.fn('ReviewStore.findOpen')(function* (input) {
        return openReviewForKey(
          (yield* list(input).pipe(Effect.orDie)).map(recordFromRow),
          input,
        );
      }),
      list: Effect.fn('ReviewStore.list')(function* (input) {
        return (yield* list(input).pipe(Effect.orDie)).map(recordFromRow);
      }),
      listRevisions: Effect.fn('ReviewStore.listRevisions')(function* (input) {
        return (yield* revisions(input).pipe(Effect.orDie)).map(reviewFromRow);
      }),
      findSummary: Effect.fn('ReviewStore.findSummary')(function* (input) {
        return Option.getOrUndefined(yield* summary(input).pipe(Effect.orDie));
      }),
      readProofFile: Effect.fn('ReviewStore.readProofFile')(function* (input) {
        return Option.getOrUndefined(
          Option.map(yield* proofFile(input).pipe(Effect.orDie), (row) => ({
            ...row,
            bytes: Uint8Array.from(row.bytes),
          })),
        );
      }),
      remove: Effect.fn('ReviewStore.remove')(function* (input) {
        return (
          (yield* sql`DELETE FROM reviews WHERE review_id = ${input.reviewId} RETURNING review_id`.pipe(
            Effect.orDie,
          )).length > 0
        );
      }),
      save: Effect.fn('ReviewStore.save')(function* (input) {
        return yield* Effect.gen(function* () {
          const current = yield* record(input);
          if (
            (Option.getOrUndefined(current)?.latestRevision ?? 0) !==
            input.expectedRevision
          )
            return yield* new ReviewConflictError();
          const {
            proofFiles,
            record: identity,
            expectedRevision: _,
            ...review
          } = input;
          const identityRow = yield* Schema.encodeEffect(
            ReviewRecordRow.insert,
          )({
            ...identity,
            pullRequest: identity.pullRequest ?? null,
            pullRequestNumber:
              reviewPullRequestNumber(identity.pullRequest) ?? null,
          });
          if (Option.isNone(current))
            yield* sql`INSERT INTO reviews ${sql.insert(identityRow)}`;
          else {
            const updated =
              yield* sql`UPDATE reviews SET latest_revision = ${identity.latestRevision}, branch = ${identity.branch}, pull_request = ${identity.pullRequest ?? null}, pull_request_number = ${reviewPullRequestNumber(identity.pullRequest) ?? null} WHERE review_id = ${identity.reviewId} AND latest_revision = ${input.expectedRevision} AND state = 'open' RETURNING review_id`;
            if (updated.length !== 1) return yield* new ReviewConflictError();
          }
          const row = yield* Schema.encodeEffect(ReviewRow.insert)({
            ...review,
            diagram: review.diagram ?? null,
            proof: review.proof ?? null,
          });
          yield* sql`INSERT INTO review_revisions ${sql.insert(row)}`;
          for (const file of proofFiles ?? [])
            yield* sql`INSERT INTO review_proof_files ${sql.insert({ reviewId: review.reviewId, revision: review.revision, id: file.id, mediaType: file.mediaType, bytes: Uint8Array.from(file.bytes) })}`;
        }).pipe(
          sql.withTransaction,
          Effect.catchIf(
            (error) => error._tag !== 'ReviewConflictError',
            Effect.die,
          ),
        );
      }),
      setState: Effect.fn('ReviewStore.setState')(function* (input) {
        yield* sql`UPDATE reviews SET state = ${input.state} WHERE review_id = ${input.reviewId}`.pipe(
          Effect.orDie,
        );
      }),
      markSeen: Effect.fn('ReviewStore.markSeen')(function* (input) {
        yield* sql`INSERT INTO review_seen (review_id, last_seen_revision) SELECT review_id, MIN(latest_revision, ${input.revision}) FROM reviews WHERE review_id = ${input.reviewId} ON CONFLICT (review_id) DO UPDATE SET last_seen_revision = MAX(last_seen_revision, excluded.last_seen_revision)`.pipe(
          Effect.orDie,
        );
      }),
    });
  }),
);
