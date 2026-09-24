import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable } from 'drizzle-orm/sqlite-core';

export const commentRevision = sqliteTable(
  'comment_revision',
  {
    singleton: integer('singleton').primaryKey(),
    revision: integer('revision').notNull(),
  },
  (table) => [check('comment_revision_singleton', sql`${table.singleton} = 1`)],
);
