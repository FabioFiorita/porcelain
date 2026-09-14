import { index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Reviewed state belongs to a worktree review, not to a project or the
// transient inventory row. Inventory refresh can recreate worktree rows while
// this table retains the reviewer's progress.
export const reviewedFiles = sqliteTable(
  'reviewed_files',
  {
    worktreeId: text('worktree_id').notNull(),
    path: text().notNull(),
    fingerprint: text().notNull(),
    reviewedAt: text('reviewed_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.worktreeId, table.path] }),
    index('reviewed_files_worktree').on(table.worktreeId),
  ],
);
