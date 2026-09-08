import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { GitActionPreparation } from '../../models/git-action.ts';

export const gitActionPreparations = sqliteTable('git_action_preparations', {
  id: text('id').primaryKey(),
  value: text('value', { mode: 'json' })
    .$type<GitActionPreparation>()
    .notNull(),
  consumed: integer('consumed', { mode: 'boolean' }).notNull().default(false),
});
