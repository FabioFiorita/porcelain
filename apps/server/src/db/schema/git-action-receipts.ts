import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { GitActionReceipt } from '../../models/git-action.ts';

export const gitActionReceipts = sqliteTable('git_action_receipts', {
  requestId: text('request_id').primaryKey(),
  value: text('value', { mode: 'json' }).$type<GitActionReceipt>().notNull(),
});
