import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { reviewLayerSets } from '../db/schema/review-layer-sets.ts';
import { worktrees } from '../db/schema/worktrees.ts';
import type { ReviewLayer, ReviewLayers } from '../models/review-layers.ts';
import { ReviewLayerConflictError } from './errors/review-layer-conflict-error.ts';
import { UnknownWorktreeError } from './errors/unknown-worktree-error.ts';
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
    if (stored) return stored;
    if (
      !this.db
        .select({ id: worktrees.id })
        .from(worktrees)
        .where(eq(worktrees.id, worktreeId))
        .get()
    )
      throw new UnknownWorktreeError();
    return { worktreeId, revision: 0, layers: [] };
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
