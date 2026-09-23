import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const reviewedFiles = sqliteTable(
  'reviewed_files',
  {
    worktreeId: text('worktree_id').notNull(),
    path: text().notNull(),
    fingerprint: text().notNull(),
    reviewedAt: text('reviewed_at').notNull(),
    stale: integer({ mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.worktreeId, table.path] }),
    index('reviewed_files_worktree').on(table.worktreeId),
  ],
);
