import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { projects } from './projects.ts';

// Retain ownership after a worktree disappears from active inventory.
export const projectWorktrees = sqliteTable(
  'project_worktrees',
  {
    worktreeId: text('worktree_id').primaryKey().notNull(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
  },
  (table) => [index('project_worktrees_project').on(table.projectId)],
);
