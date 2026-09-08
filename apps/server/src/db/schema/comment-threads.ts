import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { CommentThread } from '../../models/comment-thread.ts';
export const commentThreads = sqliteTable('comment_threads', {
  sequence: integer('sequence').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  worktreeId: text('worktree_id').notNull(),
  data: text('data', { mode: 'json' }).$type<CommentThread>().notNull(),
});
