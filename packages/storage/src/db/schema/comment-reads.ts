import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const commentReads = sqliteTable('comment_reads', {
  worktreeId: text('worktree_id').primaryKey().notNull(),
  seenThrough: integer('seen_through').notNull(),
});
