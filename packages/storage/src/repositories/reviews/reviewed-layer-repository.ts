import { and, asc, eq, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { reviewedLayers } from '../../db/schema/reviewed-layers.ts';
import type { ReviewedLayerMark } from '@porcelain/reviews/models';
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

  save(worktreeId: string, mark: ReviewedLayerMark): void {
    this.db.transaction(
      (tx) => {
        tx.insert(reviewedLayers)
          .values({ worktreeId, ...mark })
          .onConflictDoUpdate({
            target: [reviewedLayers.worktreeId, reviewedLayers.layerId],
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

  remove(worktreeId: string, layerId: string): void {
    this.db.transaction(
      (tx) => {
        tx.delete(reviewedLayers)
          .where(
            and(
              eq(reviewedLayers.worktreeId, worktreeId),
              eq(reviewedLayers.layerId, layerId),
            ),
          )
          .run();
      },
      { behavior: 'immediate' },
    );
  }

  setStale(
    worktreeId: string,
    layerIds: readonly string[],
    stale: boolean,
  ): void {
    if (layerIds.length === 0) return;
    this.db.transaction(
      (tx) => {
        tx.update(reviewedLayers)
          .set({ stale })
          .where(
            and(
              eq(reviewedLayers.worktreeId, worktreeId),
              inArray(reviewedLayers.layerId, [...layerIds]),
            ),
          )
          .run();
      },
      { behavior: 'immediate' },
    );
  }
}
