import { z } from 'zod';
import { apiErrorSchema } from '../shared/api-error.ts';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { oidSchema } from '../shared/oid.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { worktreeIdSchema } from '../shared/worktree-params.ts';

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
const branchSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine((value) => !value.includes('\0'));
const remoteSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/);
const expectedFileSchema = z.strictObject({
  path: relativePathSchema,
  fingerprint: fingerprintSchema,
});

export const gitActionScopeSchema = z.strictObject({
  projectId: z.uuid(),
  worktreeId: worktreeIdSchema,
});

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

export const gitActionIntentSchema = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('fetch'),
    remoteName: remoteSchema,
    sourceRef: refSchema,
  }),
  z.strictObject({
    action: z.literal('pull'),
    remoteName: remoteSchema,
    sourceRef: refSchema,
    strategy: z.enum(['ff-only', 'merge', 'rebase']).optional(),
  }),
  z.strictObject({
    action: z.literal('push'),
    remoteName: remoteSchema,
    destinationRef: refSchema,
    allowCreate: z.boolean(),
  }),
  z.strictObject({
    action: z.literal('commit'),
    message: messageSchema,
    paths: z.array(relativePathSchema).max(2000),
  }),
  z.strictObject({
    action: z.literal('amend'),
    message: messageSchema,
    paths: z.array(relativePathSchema).max(2000),
  }),
  z.strictObject({
    action: z.literal('stash-create'),
    message: messageSchema,
    includeUntracked: z.boolean(),
  }),
  z.strictObject({
    action: z.enum(['stash-apply', 'stash-pop']),
    stashOid: oidSchema,
    restoreIndex: z.boolean().default(false),
  }),
  z.strictObject({
    action: z.literal('discard'),
    path: relativePathSchema,
    hunk: z
      .strictObject({
        scope: z.enum(['staged', 'unstaged']),
        startLine: z.number().int().positive(),
        endLine: z.number().int().positive(),
      })
      .refine((range) => range.endLine >= range.startLine)
      .optional(),
  }),
  z.strictObject({
    action: z.literal('switch-branch'),
    branch: branchSchema,
  }),
  z.strictObject({
    action: z.literal('create-branch'),
    branch: branchSchema,
    switchTo: z.boolean(),
  }),
]);

export const gitActionExpectationSchema = z.strictObject({
  headOid: oidSchema.nullable(),
  branch: z.string().nullable(),
  inProgress: z.enum(['merge', 'rebase']).nullable(),
  mergeHeadOid: oidSchema.nullable(),
  upstreamOid: oidSchema.nullable().optional(),
  files: z.array(expectedFileSchema).max(2000).optional(),
});

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

export const runGitActionRequestSchema = z.strictObject({
  requestId: z.uuid(),
  input: gitActionIntentSchema,
  expected: gitActionExpectationSchema,
});
export const runGitActionResponseSchema = gitActionReceiptSchema;
export const runGitActionRejectedResponseSchema =
  gitActionReceiptSchema.or(apiErrorSchema);

export const readGitActionReceiptParamsSchema = z.strictObject({
  requestId: z.uuid(),
});
export const readGitActionReceiptResponseSchema = gitActionReceiptSchema;

export const dismissInterruptedGitActionParamsSchema = z.strictObject({
  projectId: z.uuid(),
  worktreeId: worktreeIdSchema,
  requestId: z.uuid(),
});
export const dismissInterruptedGitActionResponseSchema = z.object({
  dismissed: z.literal(true),
});

export const listGitBranchesResponseSchema = z.object({
  current: z.string().nullable(),
  branches: z.array(
    z.object({
      name: z.string(),
      upstream: z.string().nullable(),
      lastCommitAt: z.string(),
      checkedOutElsewhere: z.boolean(),
    }),
  ),
});

export type GitActionScope = z.output<typeof gitActionScopeSchema>;
export type GitAction = z.output<typeof gitActionSchema>;
export type GitActionIntent = z.output<typeof gitActionIntentSchema>;
export type GitActionExpectation = z.output<typeof gitActionExpectationSchema>;
export type GitActionReceipt = z.output<typeof gitActionReceiptSchema>;
export type RunGitActionRequest = z.output<typeof runGitActionRequestSchema>;
export type RunGitActionResponse = z.output<typeof runGitActionResponseSchema>;
export type RunGitActionRejectedResponse = z.output<
  typeof runGitActionRejectedResponseSchema
>;
export type ReadGitActionReceiptParams = z.output<
  typeof readGitActionReceiptParamsSchema
>;
export type ReadGitActionReceiptResponse = z.output<
  typeof readGitActionReceiptResponseSchema
>;
export type DismissInterruptedGitActionParams = z.output<
  typeof dismissInterruptedGitActionParamsSchema
>;
export type DismissInterruptedGitActionResponse = z.output<
  typeof dismissInterruptedGitActionResponseSchema
>;
export type ListGitBranchesResponse = z.output<
  typeof listGitBranchesResponseSchema
>;

function utf8Size(value: string): number {
  return Array.from(value).reduce((size, character) => {
    const point = character.codePointAt(0) ?? 0;
    if (point <= 0x7f) return size + 1;
    if (point <= 0x7ff) return size + 2;
    return size + (point <= 0xffff ? 3 : 4);
  }, 0);
}
