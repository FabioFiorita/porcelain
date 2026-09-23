import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { GitActionReceipt } from '@porcelain/git-actions/models';
import { inventoryProjects } from './inventory-projects.ts';

export const gitActionReceipts = sqliteTable(
  'git_action_receipts',
  {
    requestId: text('request_id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => inventoryProjects.id, { onDelete: 'cascade' }),
    value: text('value', { mode: 'json' }).$type<GitActionReceipt>().notNull(),
  },
  (table) => [index('git_action_receipts_project').on(table.projectId)],
);
