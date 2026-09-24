import { asc, count, eq, inArray, max, sum } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import {
  commentMessages,
  commentThreads,
} from '../../db/schema/comment-threads.ts';
import type {
  AgentReply,
  CommentMessage,
  CommentReply,
  CommentResolution,
  CommentThread,
  CommentUsage,
  NewCommentThread,
  PostedCommentMessage,
} from '@porcelain/reviews/models';
import type { CommentStore } from '@porcelain/reviews/ports';

type Transaction = Parameters<
  Parameters<BetterSQLite3Database['transaction']>[0]
>[0];
type ThreadRow = typeof commentThreads.$inferSelect;
type MessageRow = typeof commentMessages.$inferSelect;

function messageFromRow(row: MessageRow): CommentMessage {
  return {
    id: row.id,
    body: row.body,
    author: row.author,
    ...(row.createdAt === null ? {} : { createdAt: row.createdAt }),
  };
}

function threadFromRows(
  row: ThreadRow,
  messages: readonly MessageRow[],
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

function nextRevision(tx: Transaction): number {
  return (
    (tx
      .select({ revision: max(commentThreads.revision) })
      .from(commentThreads)
      .get()?.revision ?? 0) + 1
  );
}

export class SqliteCommentStore implements CommentStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  list(input: { worktreeId: string }): CommentThread[] {
    const threads = this.db
      .select()
      .from(commentThreads)
      .where(eq(commentThreads.worktreeId, input.worktreeId))
      .orderBy(asc(commentThreads.sequence))
      .all();
    const messages = this.db
      .select()
      .from(commentMessages)
      .where(eq(commentMessages.worktreeId, input.worktreeId))
      .orderBy(asc(commentMessages.sequence))
      .all();
    const byThread = new Map<string, MessageRow[]>();
    for (const message of messages) {
      const entries = byThread.get(message.threadId) ?? [];
      entries.push(message);
      byThread.set(message.threadId, entries);
    }
    return threads.map((thread) =>
      threadFromRows(thread, byThread.get(thread.id) ?? []),
    );
  }

  find(input: { threadId: string }): CommentThread | undefined {
    const row = this.db
      .select()
      .from(commentThreads)
      .where(eq(commentThreads.id, input.threadId))
      .get();
    if (!row) return undefined;
    const messages = this.db
      .select()
      .from(commentMessages)
      .where(eq(commentMessages.threadId, input.threadId))
      .orderBy(asc(commentMessages.sequence))
      .all();
    return threadFromRows(row, messages);
  }

  findMessage(input: { messageId: string }): PostedCommentMessage | undefined {
    const row = this.db
      .select()
      .from(commentMessages)
      .where(eq(commentMessages.id, input.messageId))
      .orderBy(asc(commentMessages.sequence))
      .get();
    return row
      ? {
          ...messageFromRow(row),
          threadId: row.threadId,
          worktreeId: row.worktreeId,
        }
      : undefined;
  }

  usage(input: { worktreeId: string }): CommentUsage {
    const result = this.db
      .select({ threads: count(), bytes: sum(commentThreads.sizeBytes) })
      .from(commentThreads)
      .where(eq(commentThreads.worktreeId, input.worktreeId))
      .get();
    return {
      threads: result?.threads ?? 0,
      bytes: Number(result?.bytes ?? 0),
    };
  }

  lastRevision(input: { worktreeId: string }): number {
    return (
      this.db
        .select({ revision: max(commentThreads.revision) })
        .from(commentThreads)
        .where(eq(commentThreads.worktreeId, input.worktreeId))
        .get()?.revision ?? 0
    );
  }

  agentRepliesByWorktrees(input: {
    worktreeIds: readonly string[];
  }): AgentReply[] {
    return this.db
      .select({
        worktreeId: commentThreads.worktreeId,
        threadId: commentThreads.id,
        revision: commentThreads.lastAgentRevision,
      })
      .from(commentThreads)
      .where(inArray(commentThreads.worktreeId, [...input.worktreeIds]))
      .all()
      .flatMap(({ worktreeId, threadId, revision }) =>
        revision === null ? [] : [{ worktreeId, threadId, revision }],
      );
  }

  insert(input: NewCommentThread): CommentThread {
    const { content } = input;
    return this.db.transaction(
      (tx) => {
        const revision = nextRevision(tx);
        tx.insert(commentThreads)
          .values({
            id: content.id,
            worktreeId: content.worktreeId,
            anchor: structuredClone(content.anchor),
            resolved: false,
            revision,
            lastAgentRevision: input.writtenByAgent ? revision : null,
            sizeBytes: input.sizeBytes,
          })
          .run();
        for (const message of content.messages)
          tx.insert(commentMessages)
            .values({
              id: message.id,
              threadId: content.id,
              worktreeId: content.worktreeId,
              body: message.body,
              author: message.author,
              createdAt: message.createdAt ?? null,
            })
            .run();
        return { ...structuredClone(content), resolved: false, revision };
      },
      { behavior: 'immediate' },
    );
  }

  append(input: CommentReply): CommentThread {
    const { thread, message } = input;
    return this.db.transaction(
      (tx) => {
        const revision = nextRevision(tx);
        tx.insert(commentMessages)
          .values({
            id: message.id,
            threadId: thread.id,
            worktreeId: thread.worktreeId,
            body: message.body,
            author: message.author,
            createdAt: message.createdAt ?? null,
          })
          .run();
        tx.update(commentThreads)
          .set({
            revision,
            lastAgentRevision: input.writtenByAgent ? revision : null,
            sizeBytes: input.sizeBytes,
          })
          .where(eq(commentThreads.id, thread.id))
          .run();
        return {
          ...structuredClone(thread),
          messages: structuredClone([...thread.messages, message]),
          revision,
        };
      },
      { behavior: 'immediate' },
    );
  }

  resolve(input: CommentResolution): CommentThread {
    const { thread, resolved } = input;
    return this.db.transaction(
      (tx) => {
        const revision = nextRevision(tx);
        tx.update(commentThreads)
          .set({ resolved, revision })
          .where(eq(commentThreads.id, thread.id))
          .run();
        return { ...structuredClone(thread), resolved, revision };
      },
      { behavior: 'immediate' },
    );
  }
}
