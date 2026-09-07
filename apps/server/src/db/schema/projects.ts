import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable(
  'inventory_projects',
  {
    id: text().notNull().primaryKey(),
    name: text().notNull(),
    commonDirectory: text('common_directory').notNull(),
    repositoryIdentity: text('repository_identity').notNull().unique(),
    available: integer({ mode: 'boolean' }).notNull(),
    position: integer().notNull(),
  },
  (table) => [
    check('project_id_present', sql`${table.id} IS NOT NULL`),
    check('project_available', sql`${table.available} IN (0, 1)`),
  ],
);
