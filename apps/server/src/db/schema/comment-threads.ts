import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { CommentThread } from '../../models/comment-thread.ts';
export const commentThreads = sqliteTable('comment_threads', {
  sequence: integer('sequence').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  worktreeId: text('worktree_id').notNull(),
  data: text('data', { mode: 'json' }).$type<CommentThread>().notNull(),
  /**
   * Rises with every write, across all worktrees. It is what the owner
   * acknowledges having seen: wall-clock time would hide a reply written
   * between the snapshot they read and the moment they said so.
   */
  revision: integer('revision').notNull(),
  /**
   * The revision at which the agent had the last word, or null when it did
   * not. Replying yourself clears it, because answering is seeing.
   */
  lastAgentRevision: integer('last_agent_revision'),
});
