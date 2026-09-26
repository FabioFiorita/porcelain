import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type {
  GitActionExpectation,
  GitActionIntent,
  GitActionKind,
  GitActionReason,
  GitActionReceiptState,
  GitActionResult,
} from '@porcelain/git-actions/models';
import { inventoryProjects } from './inventory-projects.ts';
import { worktreePresence } from './worktree-presence.ts';

export const gitActionReceipts = sqliteTable(
  'git_action_receipts',
  {
    requestId: text('request_id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => inventoryProjects.id, { onDelete: 'cascade' }),
    worktreeId: text('worktree_id')
      .notNull()
      .references(() => worktreePresence.worktreeId, { onDelete: 'cascade' }),
    action: text('action').$type<GitActionKind>().notNull(),
    state: text('state').$type<GitActionReceiptState>().notNull(),
    reason: text('reason').$type<GitActionReason>(),
    message: text('message'),
    refreshRequired: integer('refresh_required', { mode: 'boolean' }).notNull(),
    acceptedAt: text('accepted_at').notNull(),
    finishedAt: text('finished_at'),
    dismissedAt: text('dismissed_at'),
    intent: text('intent', { mode: 'json' }).$type<GitActionIntent>().notNull(),
    expected: text('expected', { mode: 'json' })
      .$type<GitActionExpectation>()
      .notNull(),
    result: text('result', { mode: 'json' }).$type<GitActionResult>(),
    progress: text('progress', { mode: 'json' }).$type<string[]>().notNull(),
  },
  (table) => [
    index('git_action_receipts_project').on(table.projectId),
    index('git_action_receipts_worktree').on(table.worktreeId),
  ],
);
