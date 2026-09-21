import { eq, max, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { commentReads } from '../db/schema/comment-reads.ts';
import { commentThreads } from '../db/schema/comment-threads.ts';
import type { WorktreeStatus } from '../models/worktree.ts';
import type { WorktreeStatusStore } from './interfaces/worktree-status-store.ts';

/**
 * What the sidebar's dot says about each worktree, for all of them at once.
 *
 * One statement, no Git: the whole point of replacing the per-worktree file
 * count is that opening the sidebar costs nothing. That is also why `reviewed`
 * means "everything marked, as of when it was marked" — noticing that the
 * agent has since edited an already-marked file would take a status read per
 * worktree, which is the cost this exists to avoid. The file watcher in step 6
 * is where that signal becomes free.
 */
export class WorktreeStatusRepository implements WorktreeStatusStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  status(worktreeIds: string[]): Map<string, WorktreeStatus> {
    const statuses = new Map<string, WorktreeStatus>();
    if (worktreeIds.length === 0) return statuses;
    const wanted = sql.join(
      worktreeIds.map((id) => sql`${id}`),
      sql`, `,
    );
    const rows = this.db.all<{ worktree_id: string; status: WorktreeStatus }>(
      sql`
        SELECT
          sets.worktree_id AS worktree_id,
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM json_each(sets.layers) AS layer,
                   json_each(layer.value, '$.files') AS file
              WHERE NOT EXISTS (
                SELECT 1 FROM reviewed_files AS mark
                WHERE mark.worktree_id = sets.worktree_id
                  AND mark.path = json_extract(file.value, '$.path')
                  AND mark.stale = 0
              )
            )
            THEN 'pending'
            -- Layers that name no file at all are a handoff nobody can have
            -- worked through, so they stay pending.
            WHEN EXISTS (
              SELECT 1
              FROM json_each(sets.layers) AS layer,
                   json_each(layer.value, '$.files') AS file
            )
            THEN 'reviewed'
            ELSE 'pending'
          END AS status
        FROM review_layer_sets AS sets
        WHERE sets.worktree_id IN (${wanted})
          AND json_array_length(sets.layers) > 0

        UNION ALL

        SELECT thread.worktree_id AS worktree_id, 'replied' AS status
        FROM comment_threads AS thread
        LEFT JOIN comment_reads AS read
          ON read.worktree_id = thread.worktree_id
        WHERE thread.worktree_id IN (${wanted})
          AND thread.last_agent_revision IS NOT NULL
          AND thread.last_agent_revision > coalesce(read.seen_through, 0)
      `,
    );
    // A reply is addressed to the owner and is newer than the handoff that
    // published the layers, so it wins the one dot there is.
    for (const row of rows)
      if (row.status === 'replied' || !statuses.has(row.worktree_id))
        statuses.set(row.worktree_id, row.status);
    return statuses;
  }

  /**
   * Never backwards: an older snapshot cannot un-see a newer reply. Never
   * further than this worktree has actually got, either — a number from
   * somewhere else must not blind it to every reply that follows.
   */
  markSeen(worktreeId: string, throughRevision: number): number {
    return this.db.transaction((tx) => {
      const current =
        tx
          .select({ seenThrough: commentReads.seenThrough })
          .from(commentReads)
          .where(eq(commentReads.worktreeId, worktreeId))
          .get()?.seenThrough ?? 0;
      const highest =
        tx
          .select({ revision: max(commentThreads.revision) })
          .from(commentThreads)
          .where(eq(commentThreads.worktreeId, worktreeId))
          .get()?.revision ?? 0;
      const seenThrough = Math.max(current, Math.min(throughRevision, highest));
      tx.insert(commentReads)
        .values({ worktreeId, seenThrough })
        .onConflictDoUpdate({
          target: commentReads.worktreeId,
          set: { seenThrough },
        })
        .run();
      return seenThrough;
    });
  }
}
