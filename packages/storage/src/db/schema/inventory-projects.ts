import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const inventoryProjects = sqliteTable(
  'inventory_projects',
  {
    id: text('id').notNull().primaryKey(),
    name: text('name').notNull(),
    namedByOwner: integer('named_by_owner', { mode: 'boolean' }).notNull(),
    commonDirectory: text('common_directory').notNull(),
    repositoryIdentity: text('repository_identity').notNull().unique(),
    available: integer('available', { mode: 'boolean' }).notNull(),
    position: integer('position').notNull(),
  },
  (table) => [
    check('project_id_present', sql`${table.id} IS NOT NULL`),
    check('project_available', sql`${table.available} IN (0, 1)`),
    check('project_named_by_owner', sql`${table.namedByOwner} IN (0, 1)`),
  ],
);
