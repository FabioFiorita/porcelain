import { sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { WorktreeStatus } from '@porcelain/projects/models';
import type { WorktreeStatusStore } from '@porcelain/projects/ports';

export class SqliteWorktreeStatusStore implements WorktreeStatusStore {
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
          review.worktree_id AS worktree_id,
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM json_each(review.layers) AS layer
              WHERE NOT EXISTS (
                SELECT 1 FROM reviewed_layers AS mark
                WHERE mark.worktree_id = review.worktree_id
                  AND mark.layer_id = json_extract(layer.value, '$.id')
                  AND mark.fingerprint = json_extract(layer.value, '$.fingerprint')
                  AND mark.stale = 0
              )
            )
            THEN 'pending'
            WHEN EXISTS (
              SELECT 1
              FROM json_each(review.layers) AS layer
            )
            THEN 'reviewed'
            ELSE 'pending'
          END AS status
        FROM reviews AS review
        WHERE review.worktree_id IN (${wanted})
          AND review.active = 1
          AND json_array_length(review.layers) > 0

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
    for (const row of rows)
      if (row.status === 'replied' || !statuses.has(row.worktree_id))
        statuses.set(row.worktree_id, row.status);
    return statuses;
  }
}
