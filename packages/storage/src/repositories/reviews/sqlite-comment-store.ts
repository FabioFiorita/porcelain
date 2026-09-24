import { asc, count, eq, max, sum } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import {
  commentMessages,
  commentThreads,
} from '../../db/schema/comment-threads.ts';
import type {
  CommentAppend,
  CommentMessage,
  CommentResolution,
  CommentStorage,
  CommentThread,
  CommentUsage,
  PostedCommentMessage,
} from '@porcelain/reviews/models';
import type { CommentStore } from '@porcelain/reviews/ports';

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

export class SqliteCommentStore implements CommentStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  list(worktreeId: string): CommentThread[] {
    const threads = this.db
      .select()
      .from(commentThreads)
      .where(eq(commentThreads.worktreeId, worktreeId))
      .orderBy(asc(commentThreads.sequence))
      .all();
    const messages = this.db
      .select()
      .from(commentMessages)
      .where(eq(commentMessages.worktreeId, worktreeId))
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

  find(threadId: string): CommentThread | undefined {
    const row = this.db
      .select()
      .from(commentThreads)
      .where(eq(commentThreads.id, threadId))
      .get();
    if (!row) return undefined;
    const messages = this.db
      .select()
      .from(commentMessages)
      .where(eq(commentMessages.threadId, threadId))
      .orderBy(asc(commentMessages.sequence))
      .all();
    return threadFromRows(row, messages);
  }

  findMessage(messageId: string): PostedCommentMessage | undefined {
    const row = this.db
      .select()
      .from(commentMessages)
      .where(eq(commentMessages.id, messageId))
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

  usage(worktreeId: string): CommentUsage {
    const result = this.db
      .select({ threads: count(), bytes: sum(commentThreads.sizeBytes) })
      .from(commentThreads)
      .where(eq(commentThreads.worktreeId, worktreeId))
      .get();
    return {
      threads: result?.threads ?? 0,
      bytes: Number(result?.bytes ?? 0),
    };
  }

  lastRevision(): number {
    return (
      this.db
        .select({ revision: max(commentThreads.revision) })
        .from(commentThreads)
        .get()?.revision ?? 0
    );
  }

  lastRevisionIn(worktreeId: string): number {
    return (
      this.db
        .select({ revision: max(commentThreads.revision) })
        .from(commentThreads)
        .where(eq(commentThreads.worktreeId, worktreeId))
        .get()?.revision ?? 0
    );
  }

  insert(thread: CommentThread, storage: CommentStorage): void {
    this.db.transaction(
      (tx) => {
        tx.insert(commentThreads)
          .values({
            id: thread.id,
            worktreeId: thread.worktreeId,
            anchor: structuredClone(thread.anchor),
            resolved: thread.resolved,
            revision: thread.revision,
            lastAgentRevision: storage.lastAgentRevision ?? null,
            sizeBytes: storage.sizeBytes,
          })
          .run();
        for (const message of thread.messages)
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
      },
      { behavior: 'immediate' },
    );
  }

  append(
    worktreeId: string,
    threadId: string,
    message: CommentMessage,
    change: CommentAppend,
  ): void {
    this.db.transaction(
      (tx) => {
        tx.insert(commentMessages)
          .values({
            id: message.id,
            threadId,
            worktreeId,
            body: message.body,
            author: message.author,
            createdAt: message.createdAt ?? null,
          })
          .run();
        tx.update(commentThreads)
          .set({
            revision: change.revision,
            lastAgentRevision: change.lastAgentRevision ?? null,
            sizeBytes: change.sizeBytes,
          })
          .where(eq(commentThreads.id, threadId))
          .run();
      },
      { behavior: 'immediate' },
    );
  }

  resolve(threadId: string, change: CommentResolution): void {
    this.db.transaction(
      (tx) => {
        tx.update(commentThreads)
          .set({
            resolved: change.resolved,
            revision: change.revision,
            sizeBytes: change.sizeBytes,
          })
          .where(eq(commentThreads.id, threadId))
          .run();
      },
      { behavior: 'immediate' },
    );
  }
}
