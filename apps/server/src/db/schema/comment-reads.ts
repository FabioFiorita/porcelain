import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * How far the owner has seen a worktree's discussion.
 *
 * Only an explicit act advances this — the review index prefetches comments
 * and code documents list them, so a fetch is not a reading. It never moves
 * backwards, so an older snapshot cannot un-see a newer reply.
 */
export const commentReads = sqliteTable('comment_reads', {
  worktreeId: text('worktree_id').primaryKey().notNull(),
  seenThrough: integer('seen_through').notNull(),
});
