import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const environments = sqliteTable(
  'environment',
  {
    singleton: integer().primaryKey(),
    id: text().notNull(),
  },
  (table) => [check('environment_singleton', sql`${table.singleton} = 1`)],
);
