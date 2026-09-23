import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { worktreePresence } from './worktree-presence.ts';

export const commentReads = sqliteTable('comment_reads', {
  worktreeId: text('worktree_id')
    .primaryKey()
    .notNull()
    .references(() => worktreePresence.worktreeId, { onDelete: 'cascade' }),
  seenThrough: integer('seen_through').notNull(),
});
