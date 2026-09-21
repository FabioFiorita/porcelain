import { isDeepStrictEqual } from 'node:util';
import { and, asc, count, eq, max, sum } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import {
  commentMessages,
  commentThreads,
} from '../db/schema/comment-threads.ts';
import { commentStorageSize } from '../models/comment-storage-size.ts';
import type {
  CommentMessage,
  CommentThread,
  StoredCommentThread,
} from '../models/comment-thread.ts';
import { CommentIdentityConflictError } from '../use-cases/errors/comment-identity-conflict-error.ts';
import { CommentLimitExceededError } from '../use-cases/errors/comment-limit-exceeded-error.ts';
import type { CommentStore } from './interfaces/comment-store.ts';

const THREAD_LIMIT = 100;
const MESSAGE_LIMIT = 100;
const BYTE_LIMIT = 1024 * 1024;

type ThreadRow = typeof commentThreads.$inferSelect;
type MessageRow = typeof commentMessages.$inferSelect;

function threadFromRows(
  row: ThreadRow,
  messages: readonly MessageRow[],
): StoredCommentThread {
  return {
    id: row.id,
    worktreeId: row.worktreeId,
    anchor: row.anchor,
    resolved: row.resolved,
    messages: messages.map(({ id, body, author, createdAt }) => ({
      id,
      body,
      author,
      ...(createdAt == null ? {} : { createdAt }),
    })),
    revision: row.revision,
  };
}

export class CommentRepository implements CommentStore {
  private readonly db: BetterSQLite3Database;
  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  list(worktreeId: string): StoredCommentThread[] {
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

  find(worktreeId: string, threadId: string): StoredCommentThread | undefined {
    const row = this.db
      .select()
      .from(commentThreads)
      .where(
        and(
          eq(commentThreads.worktreeId, worktreeId),
          eq(commentThreads.id, threadId),
        ),
      )
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

  usage(worktreeId: string): { threads: number; bytes: number } {
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

  create(thread: CommentThread): StoredCommentThread {
    return this.db.transaction(
      (tx) => {
        const first = thread.messages[0];
        if (!first) throw new Error('A comment thread requires a message');
        const existing = tx
          .select()
          .from(commentThreads)
          .where(eq(commentThreads.id, thread.id))
          .get();
        if (existing) {
          const messages = tx
            .select()
            .from(commentMessages)
            .where(eq(commentMessages.threadId, existing.id))
            .orderBy(asc(commentMessages.sequence))
            .all();
          const stored = threadFromRows(existing, messages);
          const original = stored.messages[0];
          if (
            existing.worktreeId !== thread.worktreeId ||
            !isDeepStrictEqual(existing.anchor, thread.anchor) ||
            original?.id !== first.id ||
            original.body !== first.body ||
            original.author !== first.author
          )
            throw new CommentIdentityConflictError();
          return stored;
        }
        if (
          tx
            .select({ id: commentMessages.id })
            .from(commentMessages)
            .where(eq(commentMessages.id, first.id))
            .get()
        )
          throw new CommentIdentityConflictError();
        const usage = tx
          .select({ threads: count(), bytes: sum(commentThreads.sizeBytes) })
          .from(commentThreads)
          .where(eq(commentThreads.worktreeId, thread.worktreeId))
          .get();
        const sizeBytes = commentStorageSize(thread);
        if (
          (usage?.threads ?? 0) >= THREAD_LIMIT ||
          Number(usage?.bytes ?? 0) + sizeBytes > BYTE_LIMIT
        )
          throw new CommentLimitExceededError();
        const revision = this.nextRevision(tx);
        tx.insert(commentThreads)
          .values({
            id: thread.id,
            worktreeId: thread.worktreeId,
            anchor: structuredClone(thread.anchor),
            resolved: false,
            revision,
            lastAgentRevision: first.author === 'agent' ? revision : null,
            sizeBytes,
          })
          .run();
        tx.insert(commentMessages)
          .values({
            id: first.id,
            threadId: thread.id,
            worktreeId: thread.worktreeId,
            body: first.body,
            author: first.author,
            createdAt: first.createdAt,
          })
          .run();
        return { ...structuredClone(thread), revision };
      },
      { behavior: 'immediate' },
    );
  }

  reply(
    worktreeId: string,
    threadId: string,
    message: CommentMessage,
  ): StoredCommentThread | undefined {
    return this.db.transaction(
      (tx) => {
        const duplicates = tx
          .select()
          .from(commentMessages)
          .where(eq(commentMessages.id, message.id))
          .all();
        if (duplicates.length > 0) {
          const duplicate = duplicates.find(
            (candidate) =>
              candidate.worktreeId === worktreeId &&
              candidate.threadId === threadId &&
              candidate.body === message.body &&
              candidate.author === message.author,
          );
          if (!duplicate) throw new CommentIdentityConflictError();
          const row = tx
            .select()
            .from(commentThreads)
            .where(eq(commentThreads.id, threadId))
            .get();
          if (!row) throw new CommentIdentityConflictError();
          const messages = tx
            .select()
            .from(commentMessages)
            .where(eq(commentMessages.threadId, threadId))
            .orderBy(asc(commentMessages.sequence))
            .all();
          return threadFromRows(row, messages);
        }
        const row = tx
          .select()
          .from(commentThreads)
          .where(
            and(
              eq(commentThreads.worktreeId, worktreeId),
              eq(commentThreads.id, threadId),
            ),
          )
          .get();
        if (!row) return undefined;
        const messages = tx
          .select()
          .from(commentMessages)
          .where(eq(commentMessages.threadId, threadId))
          .orderBy(asc(commentMessages.sequence))
          .all();
        if (messages.length >= MESSAGE_LIMIT)
          throw new CommentLimitExceededError();
        const current = threadFromRows(row, messages);
        const next: CommentThread = {
          id: current.id,
          worktreeId: current.worktreeId,
          anchor: current.anchor,
          resolved: current.resolved,
          messages: [...current.messages, structuredClone(message)],
        };
        const sizeBytes = commentStorageSize(next);
        const usage = tx
          .select({ bytes: sum(commentThreads.sizeBytes) })
          .from(commentThreads)
          .where(eq(commentThreads.worktreeId, worktreeId))
          .get();
        if (Number(usage?.bytes ?? 0) - row.sizeBytes + sizeBytes > BYTE_LIMIT)
          throw new CommentLimitExceededError();
        const revision = this.nextRevision(tx);
        tx.insert(commentMessages)
          .values({
            id: message.id,
            threadId,
            worktreeId,
            body: message.body,
            author: message.author,
            createdAt: message.createdAt,
          })
          .run();
        tx.update(commentThreads)
          .set({
            revision,
            lastAgentRevision: message.author === 'agent' ? revision : null,
            sizeBytes,
          })
          .where(eq(commentThreads.id, threadId))
          .run();
        return { ...next, revision };
      },
      { behavior: 'immediate' },
    );
  }

  resolve(
    worktreeId: string,
    threadId: string,
    resolved: boolean,
  ): StoredCommentThread | undefined {
    return this.db.transaction(
      (tx) => {
        const row = tx
          .select()
          .from(commentThreads)
          .where(
            and(
              eq(commentThreads.worktreeId, worktreeId),
              eq(commentThreads.id, threadId),
            ),
          )
          .get();
        if (!row) return undefined;
        const messages = tx
          .select()
          .from(commentMessages)
          .where(eq(commentMessages.threadId, threadId))
          .orderBy(asc(commentMessages.sequence))
          .all();
        if (row.resolved === resolved) return threadFromRows(row, messages);
        const revision = this.nextRevision(tx);
        const current = threadFromRows(row, messages);
        const next: CommentThread = {
          id: current.id,
          worktreeId: current.worktreeId,
          anchor: current.anchor,
          resolved,
          messages: current.messages,
        };
        tx.update(commentThreads)
          .set({
            resolved,
            revision,
            sizeBytes: commentStorageSize(next),
          })
          .where(eq(commentThreads.id, threadId))
          .run();
        return { ...next, revision };
      },
      { behavior: 'immediate' },
    );
  }

  private nextRevision(
    tx: Parameters<Parameters<BetterSQLite3Database['transaction']>[0]>[0],
  ): number {
    return (
      (tx
        .select({ revision: max(commentThreads.revision) })
        .from(commentThreads)
        .get()?.revision ?? 0) + 1
    );
  }
}
