import { z } from 'zod';
import { worktreeIdSchema } from './worktree-id.ts';

const relativePathSchema = z
  .string()
  .max(4096)
  .refine((path) => !path.includes('\0'));

export const liveSubscriptionSchema = z.strictObject({
  type: z.literal('subscribe'),
  /** Registered repositories stay watched even when no worktree is open. */
  projects: z.array(z.uuid()).max(128),
  worktrees: z
    .array(
      z.strictObject({
        projectId: z.uuid(),
        worktreeId: worktreeIdSchema,
        /** Active file/folder reads that may live under an ignored directory. */
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
    type: z.literal('project'),
    projectId: z.uuid(),
    change: z.enum(['files', 'preferences']),
  }),
  z.strictObject({
    type: z.literal('worktree'),
    projectId: z.uuid(),
    worktreeId: worktreeIdSchema,
    change: z.enum([
      'files',
      'git',
      'reviewed',
      'comments',
      'layers',
      'artifacts',
    ]),
  }),
]);

export type LiveSubscription = z.infer<typeof liveSubscriptionSchema>;
export type LiveNotice = z.infer<typeof liveNoticeSchema>;
