import { z } from 'zod';
import { absentAsNull } from '../shared/absent-as-null.ts';
import { apiErrorSchema } from '../shared/api-error.ts';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { gitActionReceiptSchema } from '../shared/git-action-receipt.ts';
import { oidSchema } from '../shared/oid.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { utf8ByteLength } from '../shared/utf8-bytes.ts';
import { worktreeIdSchema } from '../shared/worktree-params.ts';

const messageSchema = z
  .string()
  .min(1)
  .max(16_384)
  .refine(
    (value) =>
      value.trim().length > 0 &&
      !value.includes('\0') &&
      utf8ByteLength(value) <= 16_384,
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

export const gitActionExpectationSchema = z
  .strictObject({
    headOid: oidSchema.nullable(),
    branch: z.string().nullable(),
    inProgress: z.enum(['merge', 'rebase']).nullable(),
    mergeHeadOid: oidSchema.nullable(),
    upstreamOid: oidSchema.nullable().optional(),
    files: z.array(expectedFileSchema).max(2000).optional(),
  })
  .transform((expected) => ({
    headOid: expected.headOid ?? undefined,
    branch: expected.branch ?? undefined,
    inProgress: expected.inProgress ?? undefined,
    mergeHeadOid: expected.mergeHeadOid ?? undefined,
    ...(expected.upstreamOid === undefined
      ? {}
      : { upstream: { oid: expected.upstreamOid ?? undefined } }),
    ...(expected.files === undefined ? {} : { files: expected.files }),
  }));

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
  current: absentAsNull(z.string()),
  branches: z.array(
    z.object({
      name: z.string(),
      upstream: absentAsNull(z.string()),
      lastCommitAt: z.string(),
      checkedOutElsewhere: z.boolean(),
    }),
  ),
});

export type GitActionScope = z.output<typeof gitActionScopeSchema>;
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
