import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const gitActionBlocks = sqliteTable('git_action_blocks', {
  projectId: text('project_id').primaryKey(),
});
