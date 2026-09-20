import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { projects } from './projects.ts';

/**
 * When a worktree that has review data was last found to be gone.
 *
 * This is not a copy of Git's list: a row exists only for a worktree something
 * has been written about, and it holds a timestamp rather than a path. It is
 * what the thirty-day cleanup measures from.
 *
 * It is also the only record of which project a worktree belongs to, so
 * removing a project and collecting an absent worktree both read it that way.
 * A row appears with the first review data written for a worktree and is
 * deleted with the project or by collection — not with the last row of review
 * data, so a worktree whose comments are all deleted keeps an empty row.
 *
 * `missingSince` is set only by a listing that *succeeded* and did not include
 * the id, and cleared whenever the id appears again. A project that cannot be
 * listed leaves it alone, so an unplugged disk never starts the clock — and a
 * worktree that comes back after a long outage starts its grace period then,
 * rather than finishing it.
 */
export const worktreePresence = sqliteTable(
  'worktree_presence',
  {
    worktreeId: text('worktree_id').primaryKey().notNull(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    missingSince: text('missing_since'),
  },
  (table) => [index('worktree_presence_project').on(table.projectId)],
);
