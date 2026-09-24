import { z } from 'zod';
import { gitActionReceiptSchema } from '../shared/git-action-receipt.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { worktreeIdSchema } from '../shared/worktree-params.ts';

export const liveSubscriptionSchema = z.strictObject({
  type: z.literal('subscribe'),
  projects: z.array(z.uuid()).max(128),
  worktrees: z
    .array(
      z.strictObject({
        projectId: z.uuid(),
        worktreeId: worktreeIdSchema,
        paths: z.array(relativePathSchema).max(64),
      }),
    )
    .max(32),
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

export type LiveSubscription = z.output<typeof liveSubscriptionSchema>;
export type LiveNotice = z.output<typeof liveNoticeSchema>;
