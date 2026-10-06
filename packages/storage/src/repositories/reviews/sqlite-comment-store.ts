import { Effect, Layer, Option, Schema } from 'effect';
import { SqlClient, SqlSchema } from 'effect/sql';
import { CommentStore } from '@porcelain/reviews/ports';
import type { CommentMessage, CommentThread } from '@porcelain/reviews/models';
import {
  CommentMessageRow,
  CommentThreadRow,
} from '../../db/models/comment-threads.ts';

function messageFromRow(row: CommentMessageRow): CommentMessage {
  return {
    id: row.id,
    body: row.body,
    author: row.author,
    ...(row.createdAt === null ? {} : { createdAt: row.createdAt }),
    ...(row.editedAt === null ? {} : { editedAt: row.editedAt }),
  };
}
function threadFromRows(
  row: CommentThreadRow,
  messages: readonly CommentMessageRow[],
): CommentThread {
  return {
    id: row.id,
    worktreeId: row.worktreeId,
    anchor: row.anchor,
    resolved: row.resolved,
    messages: messages.map(messageFromRow),
    revision: row.revision,
  };
}

export const sqliteCommentStoreLayer = Layer.effect(
  CommentStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const nextRevision = SqlSchema.findOne({
      Request: Schema.Void,
      Result: Schema.Struct({ revision: Schema.Int }),
      execute: () =>
        sql`INSERT INTO comment_revision (singleton, revision) VALUES (1, 1) ON CONFLICT (singleton) DO UPDATE SET revision = revision + 1 RETURNING revision`,
    });
    const threads = SqlSchema.findAll({
      Request: Schema.Struct({ worktreeId: Schema.String }),
      Result: CommentThreadRow,
      execute: (input) =>
        sql`SELECT * FROM comment_threads WHERE worktree_id = ${input.worktreeId} ORDER BY sequence`,
    });
    const messages = SqlSchema.findAll({
      Request: Schema.Struct({ worktreeId: Schema.String }),
      Result: CommentMessageRow,
      execute: (input) =>
        sql`SELECT * FROM comment_messages WHERE worktree_id = ${input.worktreeId} ORDER BY sequence`,
    });
    const findThread = SqlSchema.findOneOption({
      Request: Schema.Struct({ threadId: Schema.String }),
      Result: CommentThreadRow,
      execute: (input) =>
        sql`SELECT * FROM comment_threads WHERE id = ${input.threadId}`,
    });
    const threadMessages = SqlSchema.findAll({
      Request: Schema.Struct({ threadId: Schema.String }),
      Result: CommentMessageRow,
      execute: (input) =>
        sql`SELECT * FROM comment_messages WHERE thread_id = ${input.threadId} ORDER BY sequence`,
    });
    const findMessage = SqlSchema.findOneOption({
      Request: Schema.Struct({ messageId: Schema.String }),
      Result: CommentMessageRow,
      execute: (input) =>
        sql`SELECT * FROM comment_messages WHERE id = ${input.messageId} ORDER BY sequence LIMIT 1`,
    });
    const usage = SqlSchema.findOne({
      Request: Schema.Struct({ worktreeId: Schema.String }),
      Result: Schema.Struct({ threads: Schema.Int, bytes: Schema.Int }),
      execute: (input) =>
        sql`SELECT COUNT(*) AS threads, COALESCE(SUM(size_bytes), 0) AS bytes FROM comment_threads WHERE worktree_id = ${input.worktreeId}`,
    });
    const lastRevision = SqlSchema.findOne({
      Request: Schema.Struct({ worktreeId: Schema.String }),
      Result: Schema.Struct({ revision: Schema.Int }),
      execute: (input) =>
        sql`SELECT COALESCE(MAX(revision), 0) AS revision FROM comment_threads WHERE worktree_id = ${input.worktreeId}`,
    });
    const agentReplies = SqlSchema.findAll({
      Request: Schema.Struct({ worktreeIds: Schema.Array(Schema.String) }),
      Result: Schema.Struct({
        worktreeId: Schema.String,
        threadId: Schema.String,
        revision: Schema.Int,
        resolved: Schema.BooleanFromBit,
      }),
      execute: (input) =>
        sql`SELECT worktree_id, id AS thread_id, last_agent_revision AS revision, resolved FROM comment_threads WHERE ${sql.in('worktreeId', input.worktreeIds)} AND last_agent_revision IS NOT NULL`,
    });
    const insertMessage = Effect.fn('CommentStore.insertMessage')(function* (
      thread: Pick<CommentThread, 'id' | 'worktreeId'>,
      message: CommentMessage,
    ) {
      const row = yield* Schema.encodeEffect(CommentMessageRow.insert)({
        id: message.id,
        threadId: thread.id,
        worktreeId: thread.worktreeId,
        body: message.body,
        author: message.author,
        createdAt: message.createdAt ?? null,
        editedAt: message.editedAt ?? null,
      });
      yield* sql`INSERT INTO comment_messages ${sql.insert(row)}`;
    });
    return CommentStore.of({
      list: Effect.fn('CommentStore.list')(function* (input) {
        return yield* Effect.gen(function* () {
          const rows = yield* threads(input);
          const allMessages = yield* messages(input);
          const byThread = new Map<string, CommentMessageRow[]>();
          for (const message of allMessages) {
            const entries = byThread.get(message.threadId) ?? [];
            entries.push(message);
            byThread.set(message.threadId, entries);
          }
          return rows.map((row) =>
            threadFromRows(row, byThread.get(row.id) ?? []),
          );
        }).pipe(sql.withTransaction, Effect.orDie);
      }),
      find: Effect.fn('CommentStore.find')(function* (input) {
        return yield* Effect.gen(function* () {
          const row = yield* findThread(input);
          if (Option.isNone(row)) return undefined;
          return threadFromRows(row.value, yield* threadMessages(input));
        }).pipe(sql.withTransaction, Effect.orDie);
      }),
      findMessage: Effect.fn('CommentStore.findMessage')(function* (input) {
        const row = yield* findMessage(input).pipe(Effect.orDie);
        if (Option.isNone(row)) return undefined;
        return {
          ...messageFromRow(row.value),
          threadId: row.value.threadId,
          worktreeId: row.value.worktreeId,
        };
      }),
      usage: Effect.fn('CommentStore.usage')(function* (input) {
        return yield* usage(input).pipe(Effect.orDie);
      }),
      lastRevision: Effect.fn('CommentStore.lastRevision')(function* (input) {
        return (yield* lastRevision(input).pipe(Effect.orDie)).revision;
      }),
      listAgentReplies: Effect.fn('CommentStore.listAgentReplies')(
        function* (input) {
          return yield* agentReplies(input).pipe(Effect.orDie);
        },
      ),
      insert: Effect.fn('CommentStore.insert')(function* (input) {
        return yield* Effect.gen(function* () {
          const { content } = input;
          const { revision } = yield* nextRevision(undefined);
          const row = yield* Schema.encodeEffect(CommentThreadRow.insert)({
            id: content.id,
            worktreeId: content.worktreeId,
            anchor: content.anchor,
            resolved: false,
            revision,
            lastAgentRevision: input.writtenByAgent ? revision : null,
            sizeBytes: input.sizeBytes,
          });
          yield* sql`INSERT INTO comment_threads ${sql.insert(row)}`;
          for (const message of content.messages)
            yield* insertMessage(content, message);
          return { ...structuredClone(content), resolved: false, revision };
        }).pipe(sql.withTransaction, Effect.orDie);
      }),
      append: Effect.fn('CommentStore.append')(function* (input) {
        return yield* Effect.gen(function* () {
          const { thread, message } = input;
          const { revision } = yield* nextRevision(undefined);
          yield* insertMessage(thread, message);
          yield* sql`UPDATE comment_threads SET revision = ${revision}, last_agent_revision = ${input.writtenByAgent ? revision : null}, size_bytes = ${input.sizeBytes} WHERE id = ${thread.id}`;
          return {
            ...structuredClone(thread),
            messages: structuredClone([...thread.messages, message]),
            revision,
          };
        }).pipe(sql.withTransaction, Effect.orDie);
      }),
      resolve: Effect.fn('CommentStore.resolve')(function* (input) {
        return yield* Effect.gen(function* () {
          const { revision } = yield* nextRevision(undefined);
          yield* sql`UPDATE comment_threads SET resolved = ${input.resolved ? 1 : 0}, revision = ${revision} WHERE id = ${input.thread.id}`;
          return {
            ...structuredClone(input.thread),
            resolved: input.resolved,
            revision,
          };
        }).pipe(sql.withTransaction, Effect.orDie);
      }),
      edit: Effect.fn('CommentStore.edit')(function* (input) {
        return yield* Effect.gen(function* () {
          const { revision } = yield* nextRevision(undefined);
          yield* sql`UPDATE comment_messages SET body = ${input.body}, edited_at = ${input.editedAt} WHERE thread_id = ${input.thread.id} AND id = ${input.messageId}`;
          yield* sql`UPDATE comment_threads SET revision = ${revision}, size_bytes = ${input.sizeBytes} WHERE id = ${input.thread.id}`;
          return {
            ...structuredClone(input.thread),
            messages: input.thread.messages.map((message) =>
              message.id === input.messageId
                ? { ...message, body: input.body, editedAt: input.editedAt }
                : structuredClone(message),
            ),
            revision,
          };
        }).pipe(sql.withTransaction, Effect.orDie);
      }),
      removeMessage: Effect.fn('CommentStore.removeMessage')(function* (input) {
        return yield* Effect.gen(function* () {
          yield* sql`DELETE FROM comment_messages WHERE thread_id = ${input.thread.id} AND id = ${input.messageId}`;
          const remaining = yield* threadMessages({
            threadId: input.thread.id,
          });
          const { revision } = yield* nextRevision(undefined);
          yield* sql`UPDATE comment_threads SET revision = ${revision}, size_bytes = ${input.sizeBytes} WHERE id = ${input.thread.id}`;
          return {
            ...structuredClone(input.thread),
            messages: remaining.map(messageFromRow),
            revision,
          };
        }).pipe(sql.withTransaction, Effect.orDie);
      }),
      remove: Effect.fn('CommentStore.remove')(function* (input) {
        yield* sql`DELETE FROM comment_threads WHERE id = ${input.threadId}`.pipe(
          Effect.orDie,
        );
      }),
    });
  }),
);
