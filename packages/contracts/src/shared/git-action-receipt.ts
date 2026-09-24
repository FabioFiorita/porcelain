import { z } from 'zod';
import { oidSchema } from './oid.ts';
import { worktreeIdSchema } from './worktree-params.ts';

export const gitActionSchema = z.enum([
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
]);

export const gitActionReceiptSchema = z.object({
  requestId: z.uuid(),
  projectId: z.uuid(),
  worktreeId: worktreeIdSchema,
  action: gitActionSchema,
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
