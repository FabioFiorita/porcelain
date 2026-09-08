import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const filePreferences = sqliteTable(
  'file_preferences',
  {
    worktreeId: text('worktree_id').notNull(),
    path: text().notNull(),
    pinned: integer({ mode: 'boolean' }).notNull(),
    hidden: integer({ mode: 'boolean' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.worktreeId, table.path] }),
    check('preference_pinned', sql`${table.pinned} IN (0, 1)`),
    check('preference_hidden', sql`${table.hidden} IN (0, 1)`),
  ],
);
