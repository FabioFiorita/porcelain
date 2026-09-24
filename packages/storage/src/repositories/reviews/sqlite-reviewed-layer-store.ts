import { and, asc, eq, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { reviewedLayers } from '../../db/schema/reviewed-layers.ts';
import type { ReviewedLayerMark } from '@porcelain/reviews/models';
import type { ReviewedLayerStore } from '@porcelain/reviews/ports';

export class SqliteReviewedLayerStore implements ReviewedLayerStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  list(input: { worktreeId: string }): ReviewedLayerMark[] {
    return this.db
      .select({
        layerId: reviewedLayers.layerId,
        fingerprint: reviewedLayers.fingerprint,
        reviewedAt: reviewedLayers.reviewedAt,
        stale: reviewedLayers.stale,
      })
      .from(reviewedLayers)
      .where(eq(reviewedLayers.worktreeId, input.worktreeId))
      .orderBy(asc(reviewedLayers.reviewedAt), asc(reviewedLayers.layerId))
      .all();
  }

  save(input: { worktreeId: string; mark: ReviewedLayerMark }): void {
    const { worktreeId, mark } = input;
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

  remove(input: { worktreeId: string; layerId: string }): void {
    this.db.transaction(
      (tx) => {
        tx.delete(reviewedLayers)
          .where(
            and(
              eq(reviewedLayers.worktreeId, input.worktreeId),
              eq(reviewedLayers.layerId, input.layerId),
            ),
          )
          .run();
      },
      { behavior: 'immediate' },
    );
  }

  setStale(input: {
    worktreeId: string;
    layerIds: readonly string[];
    stale: boolean;
  }): void {
    if (input.layerIds.length === 0) return;
    this.db.transaction(
      (tx) => {
        tx.update(reviewedLayers)
          .set({ stale: input.stale })
          .where(
            and(
              eq(reviewedLayers.worktreeId, input.worktreeId),
              inArray(reviewedLayers.layerId, [...input.layerIds]),
            ),
          )
          .run();
      },
      { behavior: 'immediate' },
    );
  }
}
