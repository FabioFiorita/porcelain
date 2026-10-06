import { Effect, Layer, Option, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { CommentSeenStore } from '@porcelain/reviews/ports';

import { CommentSeenRow } from '../../db/models/comment-reads.ts';

export const sqliteCommentSeenStoreLayer = Layer.effect(
  CommentSeenStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const read = SqlSchema.findOneOption({
      Request: Schema.Struct({ worktreeId: Schema.String }),
      Result: CommentSeenRow,
      execute: (input) =>
        sql`SELECT * FROM comment_reads WHERE worktree_id = ${input.worktreeId}`,
    });
    const byWorktrees = SqlSchema.findAll({
      Request: Schema.Struct({ worktreeIds: Schema.Array(Schema.String) }),
      Result: CommentSeenRow,
      execute: (input) =>
        sql`SELECT * FROM comment_reads WHERE ${sql.in('worktreeId', input.worktreeIds)}`,
    });

    return CommentSeenStore.of({
      seenThrough: Effect.fn('CommentSeenStore.seenThrough')(function* (
        input: Parameters<CommentSeenStore['seenThrough']>[0],
      ) {
        return Option.getOrElse(
          Option.map(
            yield* read(input).pipe(Effect.orDie),
            (row) => row.seenThrough,
          ),
          () => 0,
        );
      }),
      seenByWorktrees: Effect.fn('CommentSeenStore.seenByWorktrees')(function* (
        input: Parameters<CommentSeenStore['seenByWorktrees']>[0],
      ) {
        return yield* byWorktrees(input).pipe(Effect.orDie);
      }),
      save: Effect.fn('CommentSeenStore.save')(function* (
        input: Parameters<CommentSeenStore['save']>[0],
      ) {
        yield* sql`INSERT INTO comment_reads (worktree_id, seen_through) VALUES (${input.worktreeId}, ${input.seenThrough}) ON CONFLICT (worktree_id) DO UPDATE SET seen_through = excluded.seen_through`.pipe(
          Effect.orDie,
        );
      }),
    });
  }),
);
