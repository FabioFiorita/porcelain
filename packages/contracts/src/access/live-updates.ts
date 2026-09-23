import { z } from 'zod';
import { gitActionReceiptSchema } from '../git-actions/git-actions.ts';
import { worktreeIdSchema } from '../projects/worktree-id.ts';

const relativePathSchema = z
  .string()
  .max(4096)
  .refine((path) => !path.includes('\0'));

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
  z.strictObject({ type: z.literal('ready') }),
  z.strictObject({ type: z.literal('heartbeat') }),
  z.strictObject({ type: z.literal('inventory') }),
  z.strictObject({
    type: z.literal('git-action'),
    projectId: z.uuid(),
    worktreeId: worktreeIdSchema,
    receipt: gitActionReceiptSchema,
  }),
  z.strictObject({
    type: z.literal('project'),
    projectId: z.uuid(),
    change: z.enum(['files', 'preferences']),
  }),
  z.strictObject({
    type: z.literal('worktree'),
    projectId: z.uuid(),
    worktreeId: worktreeIdSchema,
    change: z.enum(['files', 'git', 'reviewed', 'comments', 'review']),
  }),
]);

export type LiveSubscription = z.infer<typeof liveSubscriptionSchema>;
export type LiveNotice = z.infer<typeof liveNoticeSchema>;
