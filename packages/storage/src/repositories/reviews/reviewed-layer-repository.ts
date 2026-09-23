import type { ReviewedLayerMark } from '@porcelain/reviews/models';
import { and, asc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { reviewedLayers } from '../../db/schema/reviewed-layers.ts';
import type { ReviewedLayerStore } from '@porcelain/reviews/ports';

export class ReviewedLayerRepository implements ReviewedLayerStore {
  private readonly db: BetterSQLite3Database;
  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  list(worktreeId: string): ReviewedLayerMark[] {
    return this.db
      .select({
        layerId: reviewedLayers.layerId,
        fingerprint: reviewedLayers.fingerprint,
        reviewedAt: reviewedLayers.reviewedAt,
        stale: reviewedLayers.stale,
      })
      .from(reviewedLayers)
      .where(eq(reviewedLayers.worktreeId, worktreeId))
      .orderBy(asc(reviewedLayers.reviewedAt), asc(reviewedLayers.layerId))
      .all();
  }

  set(worktreeId: string, mark: Omit<ReviewedLayerMark, 'stale'>) {
    this.db
      .insert(reviewedLayers)
      .values({ worktreeId, ...mark, stale: false })
      .onConflictDoUpdate({
        target: [reviewedLayers.worktreeId, reviewedLayers.layerId],
        set: { ...mark, stale: false },
      })
      .run();
  }

  invalidate(worktreeId: string, paths?: readonly string[]) {
    if (paths?.length === 0) return;
    this.db
      .update(reviewedLayers)
      .set({ stale: true })
      .where(eq(reviewedLayers.worktreeId, worktreeId))
      .run();
  }

  remove(worktreeId: string, layerId: string) {
    this.db
      .delete(reviewedLayers)
      .where(
        and(
          eq(reviewedLayers.worktreeId, worktreeId),
          eq(reviewedLayers.layerId, layerId),
        ),
      )
      .run();
  }
}
