import { and, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { reviews } from '../../db/schema/reviews.ts';
import type { Review, ReviewSummary } from '@porcelain/reviews/models';
import type { ReviewStore } from '@porcelain/reviews/ports';

export class ReviewRepository implements ReviewStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  read(worktreeId: string): Review | undefined {
    const row = this.db
      .select()
      .from(reviews)
      .where(eq(reviews.worktreeId, worktreeId))
      .get();
    if (!row) return undefined;
    const { diagram, ...rest } = row;
    return diagram === null ? rest : { ...rest, diagram };
  }

  findSummary(token: string): ReviewSummary | undefined {
    return this.db
      .select({
        summaryHtml: reviews.summaryHtml,
        summaryToken: reviews.summaryToken,
        summarySecret: reviews.summarySecret,
      })
      .from(reviews)
      .where(eq(reviews.summaryToken, token))
      .get();
  }

  save(review: Review): void {
    const row = { ...review, diagram: review.diagram ?? null };
    this.db.transaction(
      (tx) => {
        tx.insert(reviews)
          .values(row)
          .onConflictDoUpdate({ target: reviews.worktreeId, set: row })
          .run();
      },
      { behavior: 'immediate' },
    );
  }

  setActive(worktreeId: string, revision: number, active: boolean): void {
    this.db.transaction(
      (tx) => {
        tx.update(reviews)
          .set({ active })
          .where(
            and(
              eq(reviews.worktreeId, worktreeId),
              eq(reviews.revision, revision),
            ),
          )
          .run();
      },
      { behavior: 'immediate' },
    );
  }
}
