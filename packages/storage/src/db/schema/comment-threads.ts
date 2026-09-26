import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import type { CommentThread } from '@porcelain/reviews/models';
import { worktreePresence } from './worktree-presence.ts';

export const commentThreads = sqliteTable(
  'comment_threads',
  {
    sequence: integer('sequence').primaryKey({ autoIncrement: true }),
    id: text('id').notNull(),
    worktreeId: text('worktree_id')
      .notNull()
      .references(() => worktreePresence.worktreeId, { onDelete: 'cascade' }),
    anchor: text('anchor', { mode: 'json' })
      .$type<CommentThread['anchor']>()
      .notNull(),
    resolved: integer('resolved', { mode: 'boolean' }).notNull(),
    revision: integer('revision').notNull(),
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
    worktreeId: text('worktree_id')
      .notNull()
      .references(() => worktreePresence.worktreeId, { onDelete: 'cascade' }),
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
