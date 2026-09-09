import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const filePreferences = sqliteTable(
  'project_file_preferences',
  {
    projectId: text('project_id').notNull(),
    path: text().notNull(),
    pinned: integer({ mode: 'boolean' }).notNull(),
    hidden: integer({ mode: 'boolean' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.path] }),
    check('project_preference_pinned', sql`${table.pinned} IN (0, 1)`),
    check('project_preference_hidden', sql`${table.hidden} IN (0, 1)`),
  ],
);
