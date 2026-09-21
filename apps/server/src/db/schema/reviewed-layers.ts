import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const reviewedLayers = sqliteTable(
  'reviewed_layers',
  {
    worktreeId: text('worktree_id').notNull(),
    layerId: text('layer_id').notNull(),
    fingerprint: text().notNull(),
    reviewedAt: text('reviewed_at').notNull(),
    stale: integer({ mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.worktreeId, table.layerId] }),
    index('reviewed_layers_worktree').on(table.worktreeId),
  ],
);
