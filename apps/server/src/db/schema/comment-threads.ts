import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import type { CommentThread } from '../../models/comment-thread.ts';
export const commentThreads = sqliteTable(
  'comment_threads',
  {
    sequence: integer('sequence').primaryKey({ autoIncrement: true }),
    id: text('id').notNull(),
    worktreeId: text('worktree_id').notNull(),
    anchor: text('anchor', { mode: 'json' })
      .$type<CommentThread['anchor']>()
      .notNull(),
    resolved: integer('resolved', { mode: 'boolean' }).notNull(),
    /**
     * Rises with writes while a worktree's discussion is retained. It is what
     * the owner acknowledges having seen: wall-clock time would hide a reply
     * written between the snapshot they read and the moment they said so.
     * Cleanup removes that worktree's threads and seen marker together.
     */
    revision: integer('revision').notNull(),
    /**
     * The revision at which the agent had the last word, or null when it did
     * not. Replying yourself clears it, because answering is seeing.
     */
    lastAgentRevision: integer('last_agent_revision'),
    sizeBytes: integer('size_bytes').notNull(),
  },
  (table) => [
    uniqueIndex('comment_threads_normalized_id_unique').on(table.id),
    index('comment_threads_worktree').on(table.worktreeId),
  ],
);

export const commentMessages = sqliteTable(
  'comment_messages',
  {
    sequence: integer('sequence').primaryKey({ autoIncrement: true }),
    id: text('id').notNull(),
    threadId: text('thread_id')
      .notNull()
      .references(() => commentThreads.id, { onDelete: 'cascade' }),
    worktreeId: text('worktree_id').notNull(),
    body: text('body').notNull(),
    author: text('author').$type<'reviewer' | 'agent'>().notNull(),
    createdAt: text('created_at'),
  },
  (table) => [
    index('comment_messages_id').on(table.id),
    index('comment_messages_thread').on(table.threadId, table.sequence),
    index('comment_messages_worktree').on(table.worktreeId),
  ],
);
