import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { ReviewDiagram, ReviewLayer } from '@porcelain/reviews/models';

export const reviews = sqliteTable('reviews', {
  worktreeId: text('worktree_id').primaryKey().notNull(),
  revision: integer().notNull(),
  publishedAt: text('published_at').notNull(),
  active: integer({ mode: 'boolean' }).notNull().default(true),
  summaryHtml: text('summary_html').notNull(),
  summaryToken: text('summary_token').notNull().unique(),
  summarySecret: text('summary_secret').notNull(),
  diagram: text({ mode: 'json' }).$type<ReviewDiagram>(),
  layers: text({ mode: 'json' }).$type<ReviewLayer[]>().notNull(),
});
