import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import { inventoryProjects } from './inventory-projects.ts';

export const projectFilePreferences = sqliteTable(
  'project_file_preferences',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => inventoryProjects.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    pinned: integer('pinned', { mode: 'boolean' }).notNull(),
    hidden: integer('hidden', { mode: 'boolean' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.path] }),
    check('project_preference_pinned', sql`${table.pinned} IN (0, 1)`),
    check('project_preference_hidden', sql`${table.hidden} IN (0, 1)`),
  ],
);
