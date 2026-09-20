import { and, asc, count, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { reviewedFiles } from '../db/schema/reviewed-files.ts';
import type { ReviewedMark } from '../models/reviewed-file.ts';
import type { ReviewedFileStore } from './interfaces/reviewed-file-store.ts';

export const MAX_REVIEWED_MARKS = 2000;

export class ReviewedFileRepository implements ReviewedFileStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  list(worktreeId: string): ReviewedMark[] {
    return this.db
      .select({
        path: reviewedFiles.path,
        fingerprint: reviewedFiles.fingerprint,
        reviewedAt: reviewedFiles.reviewedAt,
      })
      .from(reviewedFiles)
      .where(eq(reviewedFiles.worktreeId, worktreeId))
      .orderBy(asc(reviewedFiles.path))
      .all();
  }

  set(
    worktreeId: string,
    path: string,
    fingerprint: string,
    reviewedAt: string,
  ): ReviewedMark {
    this.db.transaction(
      (tx) => {
        const existing = tx
          .select({ path: reviewedFiles.path })
          .from(reviewedFiles)
          .where(
            and(
              eq(reviewedFiles.worktreeId, worktreeId),
              eq(reviewedFiles.path, path),
            ),
          )
          .get();
        if (!existing) {
          const total =
            tx
              .select({ total: count() })
              .from(reviewedFiles)
              .where(eq(reviewedFiles.worktreeId, worktreeId))
              .get()?.total ?? 0;
          const removeCount = Math.max(0, total - MAX_REVIEWED_MARKS + 1);
          if (removeCount > 0) {
            const victims = tx
              .select({ path: reviewedFiles.path })
              .from(reviewedFiles)
              .where(eq(reviewedFiles.worktreeId, worktreeId))
              .orderBy(asc(reviewedFiles.reviewedAt), asc(reviewedFiles.path))
              .limit(removeCount)
              .all();
            for (const victim of victims)
              tx.delete(reviewedFiles)
                .where(
                  and(
                    eq(reviewedFiles.worktreeId, worktreeId),
                    eq(reviewedFiles.path, victim.path),
                  ),
                )
                .run();
          }
        }
        tx.insert(reviewedFiles)
          .values({ worktreeId, path, fingerprint, reviewedAt })
          .onConflictDoUpdate({
            target: [reviewedFiles.worktreeId, reviewedFiles.path],
            set: { fingerprint, reviewedAt },
          })
          .run();
      },
      { behavior: 'immediate' },
    );
    return { path, fingerprint, reviewedAt };
  }

  remove(worktreeId: string, path: string): void {
    this.db
      .delete(reviewedFiles)
      .where(
        and(
          eq(reviewedFiles.worktreeId, worktreeId),
          eq(reviewedFiles.path, path),
        ),
      )
      .run();
  }
}
