import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { projects } from './projects.ts';

export const worktreePresence = sqliteTable(
  'worktree_presence',
  {
    worktreeId: text('worktree_id').primaryKey().notNull(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    missingSince: text('missing_since'),
  },
  (table) => [index('worktree_presence_project').on(table.projectId)],
);
