import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { projects } from './projects.ts';

/**
 * Per-commit review layers, a surface removed in step 5c.
 *
 * The table stays so the rows a reader already has are not destroyed by an
 * upgrade, and project removal still clears them. Nothing reads them; dropping
 * the table is a separate decision about data somebody may still want.
 */

export const commitReviewLayerSets = sqliteTable(
  'commit_review_layer_sets',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    commitOid: text('commit_oid').notNull(),
    data: text({ mode: 'json' }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.commitOid] })],
);
