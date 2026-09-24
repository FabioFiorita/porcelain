import { and, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { reviews } from '../../db/schema/reviews.ts';
import type { Review, ReviewSummary } from '@porcelain/reviews/models';
import type { ReviewStore } from '@porcelain/reviews/ports';

export class SqliteReviewStore implements ReviewStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  read(input: { worktreeId: string }): Review | undefined {
    const row = this.db
      .select()
      .from(reviews)
      .where(eq(reviews.worktreeId, input.worktreeId))
      .get();
    if (!row) return undefined;
    const { diagram, ...rest } = row;
    return diagram === null ? rest : { ...rest, diagram };
  }

  findSummary(input: { token: string }): ReviewSummary | undefined {
    return this.db
      .select({
        summaryHtml: reviews.summaryHtml,
        summaryToken: reviews.summaryToken,
        summarySecret: reviews.summarySecret,
      })
      .from(reviews)
      .where(eq(reviews.summaryToken, input.token))
      .get();
  }

  save(input: Review): void {
    const row = { ...input, diagram: input.diagram ?? null };
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

  setActive(input: {
    worktreeId: string;
    revision: number;
    active: boolean;
  }): void {
    this.db.transaction(
      (tx) => {
        tx.update(reviews)
          .set({ active: input.active })
          .where(
            and(
              eq(reviews.worktreeId, input.worktreeId),
              eq(reviews.revision, input.revision),
            ),
          )
          .run();
      },
      { behavior: 'immediate' },
    );
  }
}
