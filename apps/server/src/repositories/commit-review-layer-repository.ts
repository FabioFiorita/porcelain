import { and, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { commitReviewLayerSets } from '../db/schema/commit-review-layer-sets.ts';
import { projectWorktrees } from '../db/schema/project-worktrees.ts';
import { reviewLayerSets } from '../db/schema/review-layer-sets.ts';
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
        const owner = tx
          .select()
          .from(projectWorktrees)
          .where(
            and(
              eq(projectWorktrees.projectId, snapshot.projectId),
              eq(projectWorktrees.worktreeId, snapshot.sourceWorktreeId),
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
