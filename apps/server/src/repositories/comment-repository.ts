import { and, asc, eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { commentThreads } from '../db/schema/comment-threads.ts';
import type { CommentThread } from '../models/comment-thread.ts';
import type { CommentStore } from './interfaces/comment-store.ts';
export class CommentRepository implements CommentStore {
  private readonly db: BetterSQLite3Database;
  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }
  list(worktreeId: string): CommentThread[] {
    return this.db
      .select()
      .from(commentThreads)
      .where(eq(commentThreads.worktreeId, worktreeId))
      .orderBy(asc(commentThreads.sequence))
      .all()
      .map((row) => row.data);
  }
  find(worktreeId: string, threadId: string): CommentThread | undefined {
    return this.db
      .select()
      .from(commentThreads)
      .where(
        and(
          eq(commentThreads.worktreeId, worktreeId),
          eq(commentThreads.id, threadId),
        ),
      )
      .get()?.data;
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
  save(thread: CommentThread): void {
    this.db
      .insert(commentThreads)
      .values({ id: thread.id, worktreeId: thread.worktreeId, data: thread })
      .onConflictDoUpdate({ target: commentThreads.id, set: { data: thread } })
      .run();
  }
}
