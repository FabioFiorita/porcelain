import { z } from 'zod';

const messageSchema = z
  .string()
  .min(1)
  .max(16_384)
  .refine(
    (value) =>
      value.trim().length > 0 &&
      !value.includes('\0') &&
      utf8Size(value) <= 16_384,
  );
const refSchema = z
  .string()
  .min(12)
  .max(1024)
  .startsWith('refs/heads/')
  .refine((value) => !value.includes('\0'));
const remoteSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/);
const oidSchema = z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/);
export const gitActionScopeSchema = z.strictObject({
  projectId: z.uuid(),
  worktreeId: z.uuid(),
});
export const fetchPreparationRequestSchema = z.strictObject({
  remoteName: remoteSchema,
  sourceRef: refSchema,
});
export const pushPreparationRequestSchema = z.strictObject({
  remoteName: remoteSchema,
  destinationRef: refSchema,
  allowCreate: z.boolean(),
});
export const commitPreparationRequestSchema = z.strictObject({
  message: messageSchema,
});
export const stashCreatePreparationRequestSchema = z.strictObject({
  message: messageSchema,
  includeUntracked: z.boolean(),
});
export const stashApplyPreparationRequestSchema = z.strictObject({
  stashOid: oidSchema,
  restoreIndex: z.boolean(),
});
export const gitActionExecutionRequestSchema = z.strictObject({
  requestId: z.uuid(),
  preparationId: z.uuid(),
});
export const gitActionRequestParamsSchema = z.strictObject({
  requestId: z.uuid(),
});
const actionSchema = z.enum([
  'fetch',
  'push',
  'commit',
  'stash-create',
  'stash-apply',
  'stash-pop',
]);
export const gitActionPreparationSchema = z.strictObject({
  preparationId: z.uuid(),
  expiresAt: z.number().int(),
  action: actionSchema,
  preview: z.strictObject({
    headOid: oidSchema.nullable(),
    branch: z.string().nullable(),
    staged: z.boolean(),
    trackedChanges: z.boolean(),
    untrackedCount: z.number().int().nonnegative(),
    destination: z.string().optional(),
    trackingOid: oidSchema.nullable().optional(),
    stashOid: oidSchema.optional(),
  }),
});
export const gitActionReceiptSchema = z.strictObject({
  requestId: z.uuid(),
  preparationId: z.uuid(),
  projectId: z.uuid(),
  worktreeId: z.uuid(),
  action: actionSchema,
  state: z.enum([
    'running',
    'succeeded',
    'no-change',
    'rejected',
    'conflicted',
    'indeterminate',
  ]),
  reason: z
    .enum([
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
  result: z
    .strictObject({
      headOid: oidSchema.optional(),
      trackingOid: oidSchema.optional(),
      sourceOid: oidSchema.optional(),
      destinationRef: z.string().optional(),
      stashOid: oidSchema.optional(),
      stashRetained: z.boolean().optional(),
    })
    .optional(),
  refreshRequired: z.boolean(),
  acceptedAt: z.number().int(),
  finishedAt: z.number().int().optional(),
});

function utf8Size(value: string): number {
  return Array.from(value).reduce((size, character) => {
    const point = character.codePointAt(0) ?? 0;
    if (point <= 0x7f) return size + 1;
    if (point <= 0x7ff) return size + 2;
    return size + (point <= 0xffff ? 3 : 4);
  }, 0);
}
