import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { ReviewDiagram, ReviewLayer } from '@porcelain/reviews/models';
import { worktreePresence } from './worktree-presence.ts';

export const reviews = sqliteTable('reviews', {
  worktreeId: text('worktree_id')
    .primaryKey()
    .notNull()
    .references(() => worktreePresence.worktreeId, { onDelete: 'cascade' }),
  revision: integer('revision').notNull(),
  publishedAt: text('published_at').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  summaryHtml: text('summary_html').notNull(),
  summaryToken: text('summary_token').notNull().unique(),
  summarySecret: text('summary_secret').notNull(),
  diagram: text('diagram', { mode: 'json' }).$type<ReviewDiagram>(),
  layers: text('layers', { mode: 'json' }).$type<ReviewLayer[]>().notNull(),
});
