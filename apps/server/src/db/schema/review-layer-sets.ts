import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { ReviewLayer } from '../../models/review-layers.ts';
// Keyed by a derived worktree id, which no table owns: a row outlives any
// listing, and only the thirty-day collection removes it.
export const reviewLayerSets = sqliteTable('review_layer_sets', {
  worktreeId: text('worktree_id').primaryKey().notNull(),
  revision: integer().notNull(),
  layers: text({ mode: 'json' }).$type<ReviewLayer[]>().notNull(),
});
