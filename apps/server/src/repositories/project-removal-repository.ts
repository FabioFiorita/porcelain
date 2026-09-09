import { eq, inArray, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { artifacts } from '../db/schema/artifacts.ts';
import { commentThreads } from '../db/schema/comment-threads.ts';
import { commitReviewLayerSets } from '../db/schema/commit-review-layer-sets.ts';
import { filePreferences } from '../db/schema/file-preferences.ts';
import { gitActionBlocks } from '../db/schema/git-action-blocks.ts';
import { gitActionPreparations } from '../db/schema/git-action-preparations.ts';
import { gitActionReceipts } from '../db/schema/git-action-receipts.ts';
import { projectWorktrees } from '../db/schema/project-worktrees.ts';
import { projects } from '../db/schema/projects.ts';
import { reviewLayerSets } from '../db/schema/review-layer-sets.ts';
import { ProjectRemovalBlockedError } from './errors/project-removal-blocked-error.ts';
import type { ProjectRemovalStore } from './interfaces/project-removal-store.ts';

export class ProjectRemovalRepository implements ProjectRemovalStore {
  private readonly db: BetterSQLite3Database;
  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }
  remove(projectId: string): { deleted: boolean } {
    return this.db.transaction(
      (tx) => {
        if (!tx.select().from(projects).where(eq(projects.id, projectId)).get())
          return { deleted: false };
        const receiptScope = sql`json_extract(${gitActionReceipts.value}, '$.projectId') = ${projectId}`;
        const blocked = tx
          .select()
          .from(gitActionBlocks)
          .where(eq(gitActionBlocks.projectId, projectId))
          .get();
        const unresolved = tx
          .select()
          .from(gitActionReceipts)
          .where(receiptScope)
          .all()
          .some(
            ({ value }) =>
              value.state === 'running' ||
              value.state === 'indeterminate' ||
              value.reason === 'PROCESS_GROUP_UNCONFIRMED',
          );
        if (blocked || unresolved) throw new ProjectRemovalBlockedError();
        const owned = tx
          .select({ id: projectWorktrees.worktreeId })
          .from(projectWorktrees)
          .where(eq(projectWorktrees.projectId, projectId));
        tx.delete(artifacts).where(inArray(artifacts.worktreeId, owned)).run();
        tx.delete(commentThreads)
          .where(inArray(commentThreads.worktreeId, owned))
          .run();
        tx.delete(filePreferences)
          .where(eq(filePreferences.projectId, projectId))
          .run();
        tx.delete(commitReviewLayerSets)
          .where(eq(commitReviewLayerSets.projectId, projectId))
          .run();
        tx.delete(reviewLayerSets)
          .where(inArray(reviewLayerSets.worktreeId, owned))
          .run();
        tx.delete(gitActionPreparations)
          .where(
            sql`json_extract(${gitActionPreparations.value}, '$.projectId') = ${projectId}`,
          )
          .run();
        tx.delete(gitActionReceipts).where(receiptScope).run();
        tx.delete(projects).where(eq(projects.id, projectId)).run();
        return { deleted: true };
      },
      { behavior: 'immediate' },
    );
  }
}
