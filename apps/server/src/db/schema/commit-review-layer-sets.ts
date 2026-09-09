import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { CommitReviewLayers } from '../../models/commit-review-layers.ts';
import { projects } from './projects.ts';

export const commitReviewLayerSets = sqliteTable(
  'commit_review_layer_sets',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    commitOid: text('commit_oid').notNull(),
    data: text({ mode: 'json' }).$type<CommitReviewLayers>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.commitOid] })],
);
