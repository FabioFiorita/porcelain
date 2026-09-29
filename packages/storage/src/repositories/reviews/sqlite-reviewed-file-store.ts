import { and, asc, eq, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { reviewedFiles } from '../../db/schema/reviewed-files.ts';
import type {
  ReviewedFileKey,
  ReviewedFileMark,
  ReviewedScope,
} from '@porcelain/reviews/models';
import type { ReviewedFileStore } from '@porcelain/reviews/ports';

export class SqliteReviewedFileStore implements ReviewedFileStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  list(input: ReviewedFileKey): ReviewedFileMark[] {
    return this.db
      .select({
        path: reviewedFiles.path,
        fingerprint: reviewedFiles.fingerprint,
        reviewedAt: reviewedFiles.reviewedAt,
        stale: reviewedFiles.stale,
      })
      .from(reviewedFiles)
      .where(inScope(input))
      .orderBy(asc(reviewedFiles.path))
      .all();
  }

  save(input: ReviewedFileKey & { marks: readonly ReviewedFileMark[] }): void {
    const { worktreeId } = input;
    const scope = scopeOf(input);
    if (input.marks.length === 0) return;
    this.db.transaction(
      (tx) => {
        for (const mark of input.marks)
          tx.insert(reviewedFiles)
            .values({ worktreeId, scope, ...mark })
            .onConflictDoUpdate({
              target: [
                reviewedFiles.worktreeId,
                reviewedFiles.scope,
                reviewedFiles.path,
              ],
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

  remove(input: ReviewedFileKey & { paths: readonly string[] }): void {
    if (input.paths.length === 0) return;
    this.db.transaction(
      (tx) => {
        tx.delete(reviewedFiles)
          .where(
            and(inScope(input), inArray(reviewedFiles.path, [...input.paths])),
          )
          .run();
      },
      { behavior: 'immediate' },
    );
  }

  setStale(
    input: ReviewedFileKey & { paths: readonly string[]; stale: boolean },
  ): void {
    if (input.paths.length === 0) return;
    this.db.transaction(
      (tx) => {
        tx.update(reviewedFiles)
          .set({ stale: input.stale })
          .where(
            and(inScope(input), inArray(reviewedFiles.path, [...input.paths])),
          )
          .run();
      },
      { behavior: 'immediate' },
    );
  }
}

function scopeOf(key: ReviewedFileKey): ReviewedScope {
  return key.scope ?? 'worktree';
}

function inScope(key: ReviewedFileKey) {
  return and(
    eq(reviewedFiles.worktreeId, key.worktreeId),
    eq(reviewedFiles.scope, scopeOf(key)),
  );
}
