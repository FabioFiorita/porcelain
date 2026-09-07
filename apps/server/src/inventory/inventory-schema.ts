import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const environments = sqliteTable(
  'environment',
  {
    singleton: integer().primaryKey(),
    id: text().notNull(),
  },
  (table) => [check('environment_singleton', sql`${table.singleton} = 1`)],
);

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
  // Kit's SQLite text primary keys omit NOT NULL; retain an explicit database invariant.
  (table) => [
    check('project_id_present', sql`${table.id} IS NOT NULL`),
    check('project_available', sql`${table.available} IN (0, 1)`),
  ],
);

export const worktrees = sqliteTable(
  'worktrees',
  {
    id: text().notNull().primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    path: text().notNull(),
    metadataIdentity: text('metadata_identity').notNull(),
    main: integer({ mode: 'boolean' }).notNull(),
    branch: text(),
    available: integer({ mode: 'boolean' }).notNull(),
    position: integer().notNull(),
  },
  (table) => [
    check('worktree_id_present', sql`${table.id} IS NOT NULL`),
    uniqueIndex('worktree_order').on(table.projectId, table.position),
    check('worktree_main', sql`${table.main} IN (0, 1)`),
    check('worktree_available', sql`${table.available} IN (0, 1)`),
  ],
);
