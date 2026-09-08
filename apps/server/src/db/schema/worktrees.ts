import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { projects } from './projects.ts';

export const worktrees = sqliteTable(
  'worktrees',
  {
    id: text().notNull().primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    path: text().notNull(),
    metadataIdentity: text('metadata_identity'),
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
