import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Inventory refresh replaces worktree rows; retained storage must not cascade with them.
export const artifacts = sqliteTable(
  'artifacts',
  {
    id: text().notNull().primaryKey(),
    worktreeId: text('worktree_id').notNull(),
    name: text().notNull(),
    content: text().notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('artifacts_worktree').on(table.worktreeId)],
);
