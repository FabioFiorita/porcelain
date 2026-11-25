import { Effect, Layer, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { DraftCommentStore } from '@porcelain/reviews/ports';
import type { StoredDraftComment } from '@porcelain/reviews/models';
import { DraftCommentRow } from '../../db/models/draft-comments.ts';

const columns = Schema.Struct({
  id: DraftCommentRow.fields.id,
  worktreeId: DraftCommentRow.fields.worktreeId,
  branch: DraftCommentRow.fields.branch,
  headOid: DraftCommentRow.fields.headOid,
  anchor: DraftCommentRow.fields.anchor,
  text: DraftCommentRow.fields.text,
  createdAt: DraftCommentRow.fields.createdAt,
  updatedAt: DraftCommentRow.fields.updatedAt,
  publishedUrl: DraftCommentRow.fields.publishedUrl,
  publishedAt: DraftCommentRow.fields.publishedAt,
});

function stored(row: typeof columns.Type): StoredDraftComment {
  return {
    id: row.id,
    worktreeId: row.worktreeId,
    branch: row.branch,
    headOid: row.headOid,
    anchor: row.anchor,
    text: row.text,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publication:
      row.publishedUrl !== null && row.publishedAt !== null
        ? {
            status: 'published',
            url: row.publishedUrl,
            publishedAt: row.publishedAt,
          }
        : { status: 'draft' },
  };
}

export const sqliteDraftCommentStoreLayer = Layer.effect(
  DraftCommentStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const list = SqlSchema.findAll({
      Request: Schema.Struct({ worktreeId: Schema.String, branch: Schema.String }),
      Result: columns,
      execute: (input) =>
        sql`SELECT id, worktree_id, branch, head_oid, anchor, text, created_at, updated_at, published_url, published_at FROM draft_comments WHERE worktree_id = ${input.worktreeId} AND branch = ${input.branch} ORDER BY sequence`,
    });
    const find = SqlSchema.findAll({
      Request: Schema.Struct({ worktreeId: Schema.String, id: Schema.String }),
      Result: columns,
      execute: (input) =>
        sql`SELECT id, worktree_id, branch, head_oid, anchor, text, created_at, updated_at, published_url, published_at FROM draft_comments WHERE worktree_id = ${input.worktreeId} AND id = ${input.id}`,
    });
    return DraftCommentStore.of({
      list: Effect.fn('DraftCommentStore.list')(function* (input) {
        return (yield* list(input).pipe(Effect.orDie)).map(stored);
      }),
      find: Effect.fn('DraftCommentStore.find')(function* (input) {
        const [row] = yield* find(input).pipe(Effect.orDie);
        return row === undefined ? undefined : stored(row);
      }),
      insert: Effect.fn('DraftCommentStore.insert')(function* (comment) {
        const row = yield* Schema.encodeEffect(DraftCommentRow.insert)({
          id: comment.id,
          worktreeId: comment.worktreeId,
          branch: comment.branch,
          headOid: comment.headOid,
          anchor: comment.anchor,
          text: comment.text,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
          publishedUrl:
            comment.publication.status === 'published'
              ? comment.publication.url
              : null,
          publishedAt:
            comment.publication.status === 'published'
              ? comment.publication.publishedAt
              : null,
        }).pipe(Effect.orDie);
        yield* sql`INSERT INTO draft_comments ${sql.insert(row)}`.pipe(
          Effect.orDie,
        );
      }),
      updateText: Effect.fn('DraftCommentStore.updateText')(function* (input) {
        yield* sql`UPDATE draft_comments SET text = ${input.text}, updated_at = ${input.updatedAt} WHERE worktree_id = ${input.worktreeId} AND id = ${input.id}`.pipe(
          Effect.orDie,
        );
      }),
      remove: Effect.fn('DraftCommentStore.remove')(function* (input) {
        yield* sql`DELETE FROM draft_comments WHERE worktree_id = ${input.worktreeId} AND id = ${input.id}`.pipe(
          Effect.orDie,
        );
      }),
      markPublished: Effect.fn('DraftCommentStore.markPublished')(function* (
        input,
      ) {
        if (!input.ids.length) return;
        yield* sql`UPDATE draft_comments SET published_url = ${input.url}, published_at = ${input.publishedAt} WHERE worktree_id = ${input.worktreeId} AND ${sql.in('id', input.ids)}`.pipe(
          Effect.orDie,
        );
      }),
    });
  }),
);
