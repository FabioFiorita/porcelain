import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import { worktreePresence } from './worktree-presence.ts';

export const reviewedFiles = sqliteTable(
  'reviewed_files',
  {
    worktreeId: text('worktree_id')
      .notNull()
      .references(() => worktreePresence.worktreeId, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    fingerprint: text('fingerprint').notNull(),
    reviewedAt: text('reviewed_at').notNull(),
    stale: integer('stale', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.worktreeId, table.path] }),
    index('reviewed_files_worktree').on(table.worktreeId),
  ],
);
