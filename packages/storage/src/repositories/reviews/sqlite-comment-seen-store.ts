import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { commentReads } from '../../db/schema/comment-reads.ts';
import type { CommentSeenStore } from '@porcelain/reviews/ports';

export class SqliteCommentSeenStore implements CommentSeenStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  seenThrough(input: { worktreeId: string }): number {
    return (
      this.db
        .select({ seenThrough: commentReads.seenThrough })
        .from(commentReads)
        .where(eq(commentReads.worktreeId, input.worktreeId))
        .get()?.seenThrough ?? 0
    );
  }

  save(input: { worktreeId: string; seenThrough: number }): void {
    const { worktreeId, seenThrough } = input;
    this.db.transaction(
      (tx) => {
        tx.insert(commentReads)
          .values({ worktreeId, seenThrough })
          .onConflictDoUpdate({
            target: commentReads.worktreeId,
            set: { seenThrough },
          })
          .run();
      },
      { behavior: 'immediate' },
    );
  }
}
