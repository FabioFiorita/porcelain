import { and, asc, eq, max, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { commentThreads } from '../db/schema/comment-threads.ts';
import type {
  CommentThread,
  StoredCommentThread,
} from '../models/comment-thread.ts';
import type { CommentStore } from './interfaces/comment-store.ts';
export class CommentRepository implements CommentStore {
  private readonly db: BetterSQLite3Database;
  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }
  list(worktreeId: string): StoredCommentThread[] {
    return this.db
      .select()
      .from(commentThreads)
      .where(eq(commentThreads.worktreeId, worktreeId))
      .orderBy(asc(commentThreads.sequence))
      .all()
      .map((row) => ({ ...row.data, revision: row.revision }));
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
    return row ? { ...row.data, revision: row.revision } : undefined;
  }
  usage(worktreeId: string): { threads: number; bytes: number } {
    const result = this.db
      .select({
        threads: sql<number>`count(*)`,
        bytes: sql<number>`coalesce(sum(length(cast(${commentThreads.data} as blob)) + case when json_extract(${commentThreads.data}, '$.resolved') = 1 then 1 else 0 end), 0)`,
      })
      .from(commentThreads)
      .where(eq(commentThreads.worktreeId, worktreeId))
      .get();
    return result ?? { threads: 0, bytes: 0 };
  }
  save(thread: CommentThread): StoredCommentThread {
    // The revision and the write are one transaction: two replies landing
    // together must not be handed the same number, or acknowledging one would
    // acknowledge the other.
    return this.db.transaction((tx) => {
      const revision =
        (tx
          .select({ revision: max(commentThreads.revision) })
          .from(commentThreads)
          .get()?.revision ?? 0) + 1;
      const stored = tx
        .select()
        .from(commentThreads)
        .where(eq(commentThreads.id, thread.id))
        .get();
      const spoke = thread.messages.at(-1);
      // Null when the owner had the last word: answering a reply is seeing it.
      //
      // When the agent still has it, the revision is the one its message was
      // written at, carried forward rather than re-stamped. Resolving a thread
      // is a write like any other, and re-stamping would raise the dot again
      // for a reply the owner had already read and closed.
      const lastAgentRevision =
        spoke?.author !== 'agent'
          ? null
          : stored?.data.messages.at(-1)?.id === spoke.id
            ? (stored.lastAgentRevision ?? revision)
            : revision;
      const values = {
        id: thread.id,
        worktreeId: thread.worktreeId,
        data: thread,
        revision,
        lastAgentRevision,
      };
      tx.insert(commentThreads)
        .values(values)
        .onConflictDoUpdate({
          target: commentThreads.id,
          set: { data: thread, revision, lastAgentRevision },
        })
        .run();
      return { ...thread, revision };
    });
  }
}
