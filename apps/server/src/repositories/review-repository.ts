import { and, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { reviews } from '../db/schema/reviews.ts';
import type { StoredReview } from '../models/review.ts';
import { ReviewConflictError } from './errors/review-conflict-error.ts';
import type { ReviewStore } from './interfaces/review-store.ts';

export class ReviewRepository implements ReviewStore {
  private readonly db: BetterSQLite3Database;
  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  read(worktreeId: string): StoredReview | null {
    const stored = this.db
      .select()
      .from(reviews)
      .where(eq(reviews.worktreeId, worktreeId))
      .get();
    if (!stored) return null;
    const { diagram, ...rest } = stored;
    return diagram === null ? rest : { ...rest, diagram };
  }

  readSummary(token: string) {
    return (
      this.db
        .select({
          summaryHtml: reviews.summaryHtml,
          summaryToken: reviews.summaryToken,
          summarySecret: reviews.summarySecret,
        })
        .from(reviews)
        .where(eq(reviews.summaryToken, token))
        .get() ?? null
    );
  }

  replace(review: StoredReview, expectedRevision: number): StoredReview {
    return this.db.transaction(
      () => {
        const current = this.read(review.worktreeId);
        if ((current?.revision ?? 0) !== expectedRevision)
          throw new ReviewConflictError();
        this.db
          .insert(reviews)
          .values(review)
          .onConflictDoUpdate({ target: reviews.worktreeId, set: review })
          .run();
        return review;
      },
      { behavior: 'immediate' },
    );
  }

  setActive(worktreeId: string, revision: number, active: boolean) {
    this.db
      .update(reviews)
      .set({ active })
      .where(
        and(eq(reviews.worktreeId, worktreeId), eq(reviews.revision, revision)),
      )
      .run();
  }
}
