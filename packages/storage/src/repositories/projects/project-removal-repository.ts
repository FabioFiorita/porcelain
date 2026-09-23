import { eq, inArray, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { commentReads } from '../../db/schema/comment-reads.ts';
import { commentThreads } from '../../db/schema/comment-threads.ts';
import { filePreferences } from '../../db/schema/file-preferences.ts';
import { gitActionBlocks } from '../../db/schema/git-action-blocks.ts';
import { gitActionPreparations } from '../../db/schema/git-action-preparations.ts';
import { gitActionReceipts } from '../../db/schema/git-action-receipts.ts';
import { projects } from '../../db/schema/projects.ts';
import { reviewedFiles } from '../../db/schema/reviewed-files.ts';
import { reviewedLayers } from '../../db/schema/reviewed-layers.ts';
import { reviews } from '../../db/schema/reviews.ts';
import { worktreePresence } from '../../db/schema/worktree-presence.ts';
import type { ProjectRemovalStore } from '@porcelain/projects/ports';

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
        const owned = tx
          .select({ id: worktreePresence.worktreeId })
          .from(worktreePresence)
          .where(eq(worktreePresence.projectId, projectId));
        tx.delete(commentThreads)
          .where(inArray(commentThreads.worktreeId, owned))
          .run();
        tx.delete(filePreferences)
          .where(eq(filePreferences.projectId, projectId))
          .run();
        tx.delete(reviewedFiles)
          .where(inArray(reviewedFiles.worktreeId, owned))
          .run();
        tx.delete(reviewedLayers)
          .where(inArray(reviewedLayers.worktreeId, owned))
          .run();
        tx.delete(reviews).where(inArray(reviews.worktreeId, owned)).run();
        tx.delete(commentReads)
          .where(inArray(commentReads.worktreeId, owned))
          .run();
        tx.delete(gitActionBlocks)
          .where(eq(gitActionBlocks.projectId, projectId))
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
