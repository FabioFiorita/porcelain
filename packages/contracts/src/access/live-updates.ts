import { z } from 'zod';
import { oidSchema } from '../shared/oid.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { worktreeIdSchema } from '../shared/worktree-params.ts';

// Duplicated from git-actions/git-actions.ts so this folder imports only shared.
const gitActionReceiptSchema = z.object({
  requestId: z.uuid(),
  projectId: z.uuid(),
  worktreeId: worktreeIdSchema,
  action: z.enum([
    'fetch',
    'pull',
    'push',
    'commit',
    'amend',
    'stash-create',
    'stash-apply',
    'stash-pop',
    'discard',
    'switch-branch',
    'create-branch',
  ]),
  state: z.enum([
    'running',
    'succeeded',
    'no-change',
    'rejected',
    'conflicted',
    'interrupted',
  ]),
  reason: z
    .enum([
      'CHANGED_SINCE_LOOKED',
      'STALE_PREPARATION',
      'REQUEST_MISMATCH',
      'CHECKOUT_BUSY',
      'UNSUPPORTED_CONFIGURATION',
      'NON_FAST_FORWARD',
      'GIT_REJECTED',
      'DEADLINE_EXCEEDED',
      'OUTCOME_UNKNOWN',
      'PROCESS_GROUP_UNCONFIRMED',
    ])
    .optional(),
  message: z.string().optional(),
  progress: z.array(z.string()),
  result: z
    .object({
      headOid: oidSchema.optional(),
      trackingOid: oidSchema.optional(),
      sourceOid: oidSchema.optional(),
      destinationRef: z.string().optional(),
      stashOid: oidSchema.optional(),
      stashRetained: z.boolean().optional(),
      restoreStashOid: oidSchema.optional(),
      restoreIndex: z.boolean().optional(),
      branch: z.string().optional(),
    })
    .optional(),
  acceptedAt: z.number().int(),
  finishedAt: z.number().int().optional(),
});

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
