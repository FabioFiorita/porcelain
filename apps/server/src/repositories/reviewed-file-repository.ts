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
            set: { fingerprint, reviewedAt, stale: false },
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

  invalidate(worktreeId: string, paths?: readonly string[]): void {
    const selected = paths ? [...new Set(paths)] : null;
    if (selected?.length === 0) return;
    if (!selected) {
      this.db
        .update(reviewedFiles)
        .set({ stale: true })
        .where(eq(reviewedFiles.worktreeId, worktreeId))
        .run();
      return;
    }
    this.db.transaction((tx) => {
      const marks = tx
        .select({ path: reviewedFiles.path })
        .from(reviewedFiles)
        .where(eq(reviewedFiles.worktreeId, worktreeId))
        .all();
      for (const mark of marks) {
        if (
          !selected.some(
            (path) => mark.path === path || mark.path.startsWith(`${path}/`),
          )
        )
          continue;
        tx.update(reviewedFiles)
          .set({ stale: true })
          .where(
            and(
              eq(reviewedFiles.worktreeId, worktreeId),
              eq(reviewedFiles.path, mark.path),
            ),
          )
          .run();
      }
    });
  }

  reconcile(
    worktreeId: string,
    fingerprints: ReadonlyMap<string, string | null>,
  ): void {
    this.db.transaction((tx) => {
      const marks = tx
        .select({
          path: reviewedFiles.path,
          fingerprint: reviewedFiles.fingerprint,
          stale: reviewedFiles.stale,
        })
        .from(reviewedFiles)
        .where(eq(reviewedFiles.worktreeId, worktreeId))
        .all();
      for (const mark of marks) {
        const fingerprint = fingerprints.get(mark.path);
        const stale = fingerprint !== mark.fingerprint;
        if (stale === mark.stale) continue;
        tx.update(reviewedFiles)
          .set({ stale })
          .where(
            and(
              eq(reviewedFiles.worktreeId, worktreeId),
              eq(reviewedFiles.path, mark.path),
            ),
          )
          .run();
      }
    });
  }
}
