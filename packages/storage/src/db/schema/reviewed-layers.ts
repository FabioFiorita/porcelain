import { index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { worktreePresence } from './worktree-presence.ts';

export const reviewedLayers = sqliteTable(
  'reviewed_layers',
  {
    worktreeId: text('worktree_id')
      .notNull()
      .references(() => worktreePresence.worktreeId, { onDelete: 'cascade' }),
    layerId: text('layer_id').notNull(),
    fingerprint: text('fingerprint').notNull(),
    reviewedAt: text('reviewed_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.worktreeId, table.layerId] }),
    index('reviewed_layers_worktree').on(table.worktreeId),
  ],
);
