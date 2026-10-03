import { blob, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { ProofMediaType } from '@porcelain/reviews/models';
import { reviews } from './reviews.ts';

export const reviewProofFiles = sqliteTable(
  'review_proof_files',
  {
    worktreeId: text('worktree_id')
      .notNull()
      .references(() => reviews.worktreeId, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    mediaType: text('media_type').$type<ProofMediaType>().notNull(),
    bytes: blob('bytes', { mode: 'buffer' }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.worktreeId, table.id] })],
);
