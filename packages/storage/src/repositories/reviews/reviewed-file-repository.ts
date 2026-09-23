import { and, asc, count, eq, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { reviewedFiles } from '../../db/schema/reviewed-files.ts';
import type { ReviewedFileMark } from '@porcelain/reviews/models';
import type { ReviewedFileStore } from '@porcelain/reviews/ports';

const markColumns = {
  path: reviewedFiles.path,
  fingerprint: reviewedFiles.fingerprint,
  reviewedAt: reviewedFiles.reviewedAt,
  stale: reviewedFiles.stale,
};

export class ReviewedFileRepository implements ReviewedFileStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  list(worktreeId: string): ReviewedFileMark[] {
    return this.db
      .select(markColumns)
      .from(reviewedFiles)
      .where(eq(reviewedFiles.worktreeId, worktreeId))
      .orderBy(asc(reviewedFiles.path))
      .all();
  }

  find(worktreeId: string, path: string): ReviewedFileMark | undefined {
    return this.db
      .select(markColumns)
      .from(reviewedFiles)
      .where(
        and(
          eq(reviewedFiles.worktreeId, worktreeId),
          eq(reviewedFiles.path, path),
        ),
      )
      .get();
  }

  count(worktreeId: string): number {
    return (
      this.db
        .select({ total: count() })
        .from(reviewedFiles)
        .where(eq(reviewedFiles.worktreeId, worktreeId))
        .get()?.total ?? 0
    );
  }

  oldest(worktreeId: string, limit: number): string[] {
    return this.db
      .select({ path: reviewedFiles.path })
      .from(reviewedFiles)
      .where(eq(reviewedFiles.worktreeId, worktreeId))
      .orderBy(asc(reviewedFiles.reviewedAt), asc(reviewedFiles.path))
      .limit(limit)
      .all()
      .map((row) => row.path);
  }

  save(worktreeId: string, mark: ReviewedFileMark): void {
    this.db.transaction(
      (tx) => {
        tx.insert(reviewedFiles)
          .values({ worktreeId, ...mark })
          .onConflictDoUpdate({
            target: [reviewedFiles.worktreeId, reviewedFiles.path],
            set: {
              fingerprint: mark.fingerprint,
              reviewedAt: mark.reviewedAt,
              stale: mark.stale,
            },
          })
          .run();
      },
      { behavior: 'immediate' },
    );
  }

  remove(worktreeId: string, paths: readonly string[]): void {
    if (paths.length === 0) return;
    this.db.transaction(
      (tx) => {
        tx.delete(reviewedFiles)
          .where(
            and(
              eq(reviewedFiles.worktreeId, worktreeId),
              inArray(reviewedFiles.path, [...paths]),
            ),
          )
          .run();
      },
      { behavior: 'immediate' },
    );
  }

  setStale(worktreeId: string, paths: readonly string[], stale: boolean): void {
    if (paths.length === 0) return;
    this.db.transaction(
      (tx) => {
        tx.update(reviewedFiles)
          .set({ stale })
          .where(
            and(
              eq(reviewedFiles.worktreeId, worktreeId),
              inArray(reviewedFiles.path, [...paths]),
            ),
          )
          .run();
      },
      { behavior: 'immediate' },
    );
  }
}
