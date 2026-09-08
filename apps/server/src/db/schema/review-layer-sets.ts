import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { ReviewLayer } from '../../models/review-layers.ts';
// Independent lifetime: inventory refresh deletes and recreates worktree rows.
export const reviewLayerSets = sqliteTable('review_layer_sets', {
  worktreeId: text('worktree_id').primaryKey().notNull(),
  revision: integer().notNull(),
  layers: text({ mode: 'json' }).$type<ReviewLayer[]>().notNull(),
});
