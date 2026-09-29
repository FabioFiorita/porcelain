import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const environmentName = sqliteTable(
  'environment_name',
  {
    singleton: integer('singleton').primaryKey(),
    name: text('name').notNull(),
  },
  (table) => [check('environment_name_singleton', sql`${table.singleton} = 1`)],
);
