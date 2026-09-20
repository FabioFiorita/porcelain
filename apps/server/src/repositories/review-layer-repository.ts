import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { reviewLayerSets } from '../db/schema/review-layer-sets.ts';
import type { ReviewLayer, ReviewLayers } from '../models/review-layers.ts';
import { ReviewLayerConflictError } from './errors/review-layer-conflict-error.ts';
import type { ReviewLayerStore } from './interfaces/review-layer-store.ts';

export class ReviewLayerRepository implements ReviewLayerStore {
  private readonly db: BetterSQLite3Database;
  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  read(worktreeId: string): ReviewLayers {
    const stored = this.db
      .select()
      .from(reviewLayerSets)
      .where(eq(reviewLayerSets.worktreeId, worktreeId))
      .get();
    // Whether the worktree exists is settled before this is called, by the
    // one resolver everything asks. A worktree that simply has no layers yet
    // has an empty set, not an unknown one.
    return stored ?? { worktreeId, revision: 0, layers: [] };
  }

  replace(
    worktreeId: string,
    expectedRevision: number,
    layers: ReviewLayer[],
  ): ReviewLayers {
    return this.db.transaction(
      () => {
        const current = this.read(worktreeId);
        if (current.revision !== expectedRevision)
          throw new ReviewLayerConflictError();
        const next = { worktreeId, revision: expectedRevision + 1, layers };
        this.db
          .insert(reviewLayerSets)
          .values(next)
          .onConflictDoUpdate({ target: reviewLayerSets.worktreeId, set: next })
          .run();
        return next;
      },
      { behavior: 'immediate' },
    );
  }
}
