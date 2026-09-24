import { z } from 'zod';
import {
  LIVE_PATHS_PER_WORKTREE,
  LIVE_PROJECTS,
  LIVE_WORKTREES,
} from '../shared/limits.ts';
import { gitActionReceiptSchema } from '../shared/git-action-receipt.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { worktreeIdSchema } from '../shared/worktree-params.ts';

export const liveSubscriptionSchema = z.strictObject({
  type: z.literal('subscribe'),
  projects: z.array(z.uuid()).max(LIVE_PROJECTS),
  worktrees: z
    .array(
      z.strictObject({
        projectId: z.uuid(),
        worktreeId: worktreeIdSchema,
        paths: z.array(relativePathSchema).max(LIVE_PATHS_PER_WORKTREE),
      }),
    )
    .max(LIVE_WORKTREES),
});

export const liveNoticeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready') }),
  z.object({ type: z.literal('heartbeat') }),
  z.object({ type: z.literal('inventory') }),
  z.object({
    type: z.literal('git-action'),
    projectId: z.uuid(),
    worktreeId: worktreeIdSchema,
    receipt: gitActionReceiptSchema,
  }),
  z.object({
    type: z.literal('project'),
    projectId: z.uuid(),
    change: z.enum(['files', 'preferences']),
  }),
  z.object({
    type: z.literal('worktree'),
    projectId: z.uuid(),
    worktreeId: worktreeIdSchema,
    change: z.enum(['files', 'git', 'reviewed', 'comments', 'review']),
  }),
]);

export type LiveNotice = z.output<typeof liveNoticeSchema>;
