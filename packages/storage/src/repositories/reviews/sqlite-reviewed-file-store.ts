import { and, asc, eq, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { reviewedFiles } from '../../db/schema/reviewed-files.ts';
import type { ReviewedFileMark } from '@porcelain/reviews/models';
import type { ReviewedFileStore } from '@porcelain/reviews/ports';

export class SqliteReviewedFileStore implements ReviewedFileStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  list(input: { worktreeId: string }): ReviewedFileMark[] {
    return this.db
      .select({
        path: reviewedFiles.path,
        fingerprint: reviewedFiles.fingerprint,
        reviewedAt: reviewedFiles.reviewedAt,
        stale: reviewedFiles.stale,
      })
      .from(reviewedFiles)
      .where(eq(reviewedFiles.worktreeId, input.worktreeId))
      .orderBy(asc(reviewedFiles.path))
      .all();
  }

  save(input: {
    worktreeId: string;
    marks: readonly ReviewedFileMark[];
  }): void {
    const { worktreeId } = input;
    if (input.marks.length === 0) return;
    this.db.transaction(
      (tx) => {
        for (const mark of input.marks)
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

  remove(input: { worktreeId: string; paths: readonly string[] }): void {
    if (input.paths.length === 0) return;
    this.db.transaction(
      (tx) => {
        tx.delete(reviewedFiles)
          .where(
            and(
              eq(reviewedFiles.worktreeId, input.worktreeId),
              inArray(reviewedFiles.path, [...input.paths]),
            ),
          )
          .run();
      },
      { behavior: 'immediate' },
    );
  }

  setStale(input: {
    worktreeId: string;
    paths: readonly string[];
    stale: boolean;
  }): void {
    if (input.paths.length === 0) return;
    this.db.transaction(
      (tx) => {
        tx.update(reviewedFiles)
          .set({ stale: input.stale })
          .where(
            and(
              eq(reviewedFiles.worktreeId, input.worktreeId),
              inArray(reviewedFiles.path, [...input.paths]),
            ),
          )
          .run();
      },
      { behavior: 'immediate' },
    );
  }
}
