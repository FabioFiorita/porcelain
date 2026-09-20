import { and, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { commitReviewLayerSets } from '../db/schema/commit-review-layer-sets.ts';
import { reviewLayerSets } from '../db/schema/review-layer-sets.ts';
import { worktreePresence } from '../db/schema/worktree-presence.ts';
import type { CommitReviewLayers } from '../models/commit-review-layers.ts';
import { CommitReviewLayerConflictError } from '../use-cases/errors/commit-review-layer-conflict-error.ts';
import { StaleReviewLayerSourceError } from '../use-cases/errors/stale-review-layer-source-error.ts';
import { WorktreeNotFoundError } from '../use-cases/errors/worktree-not-found-error.ts';
import type { CommitReviewLayerStore } from './interfaces/commit-review-layer-store.ts';

export class CommitReviewLayerRepository implements CommitReviewLayerStore {
  private readonly db: BetterSQLite3Database;
  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }
  complete(
    snapshot: CommitReviewLayers,
    remaining: CommitReviewLayers['layers'],
  ): void {
    this.db.transaction(
      () => {
        this.create(snapshot);
        this.db
          .update(reviewLayerSets)
          .set({ revision: snapshot.sourceRevision + 1, layers: remaining })
          .where(eq(reviewLayerSets.worktreeId, snapshot.sourceWorktreeId))
          .run();
      },
      { behavior: 'immediate' },
    );
  }
  read(projectId: string, commitOid: string): CommitReviewLayers | null {
    return (
      this.db
        .select()
        .from(commitReviewLayerSets)
        .where(
          and(
            eq(commitReviewLayerSets.projectId, projectId),
            eq(commitReviewLayerSets.commitOid, commitOid),
          ),
        )
        .get()?.data ?? null
    );
  }
  create(snapshot: CommitReviewLayers): CommitReviewLayers {
    return this.db.transaction(
      (tx) => {
        const existing = this.read(snapshot.projectId, snapshot.commitOid);
        if (existing) {
          if (JSON.stringify(existing) !== JSON.stringify(snapshot))
            throw new CommitReviewLayerConflictError();
          return existing;
        }
        // The source worktree has to belong to this project: archiving one
        // project's review under another's commit would misattribute it.
        const owner = tx
          .select()
          .from(worktreePresence)
          .where(
            and(
              eq(worktreePresence.projectId, snapshot.projectId),
              eq(worktreePresence.worktreeId, snapshot.sourceWorktreeId),
            ),
          )
          .get();
        if (!owner) throw new WorktreeNotFoundError();
        const source = tx
          .select({ revision: reviewLayerSets.revision })
          .from(reviewLayerSets)
          .where(eq(reviewLayerSets.worktreeId, snapshot.sourceWorktreeId))
          .get();
        if (source?.revision !== snapshot.sourceRevision)
          throw new StaleReviewLayerSourceError();
        tx.insert(commitReviewLayerSets)
          .values({
            projectId: snapshot.projectId,
            commitOid: snapshot.commitOid,
            data: snapshot,
          })
          .run();
        return snapshot;
      },
      { behavior: 'immediate' },
    );
  }
}
