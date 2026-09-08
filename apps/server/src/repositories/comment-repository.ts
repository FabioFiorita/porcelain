import { asc, eq } from 'drizzle-orm';
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
  save(thread: CommentThread): void {
    this.db
      .insert(commentThreads)
      .values({ id: thread.id, worktreeId: thread.worktreeId, data: thread })
      .onConflictDoUpdate({ target: commentThreads.id, set: { data: thread } })
      .run();
  }
}
