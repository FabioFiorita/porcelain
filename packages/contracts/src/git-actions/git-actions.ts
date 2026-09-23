import { z } from 'zod';
import { apiErrorSchema } from '../access/api-error.ts';
import { gitPathSchema } from '../changes/git-status.ts';
import { worktreeIdSchema } from '../projects/worktree-id.ts';

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
const oidSchema = z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/);
const expectedFileSchema = z.strictObject({
  path: gitPathSchema,
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});

export const gitActionScopeSchema = z.strictObject({
  projectId: z.uuid(),
  worktreeId: worktreeIdSchema,
});

export const gitActionInputSchema = z.discriminatedUnion('action', [
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
    paths: z.array(gitPathSchema).max(2000),
  }),
  z.strictObject({
    action: z.literal('amend'),
    message: messageSchema,
    paths: z.array(gitPathSchema).max(2000),
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
    path: gitPathSchema,
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

export const runGitActionRequestSchema = z
  .strictObject({
    requestId: z.uuid(),
    input: gitActionInputSchema,
    expected: gitActionExpectationSchema,
  })
  .superRefine(({ input, expected }, context) => {
    const paths = expected.files?.map((file) => file.path) ?? [];
    if (new Set(paths).size !== paths.length)
      context.addIssue({
        code: 'custom',
        message: 'Expected file paths must be unique',
        path: ['expected', 'files'],
      });
    if ((expected.inProgress === 'merge') !== (expected.mergeHeadOid !== null))
      context.addIssue({
        code: 'custom',
        message: 'Merge state needs the exact displayed merge parent',
        path: ['expected', 'mergeHeadOid'],
      });
    if (input.action === 'commit' || input.action === 'amend') {
      const selected = new Set(input.paths);
      const mergeCommit =
        input.action === 'commit' && expected.inProgress === 'merge';
      if (input.action === 'commit' && input.paths.length === 0 && !mergeCommit)
        context.addIssue({
          code: 'custom',
          message: 'Ordinary commits need at least one selected path',
          path: ['input', 'paths'],
        });
      if (
        expected.files === undefined ||
        (mergeCommit
          ? [...selected].some((path) => !paths.includes(path))
          : paths.length !== selected.size ||
            paths.some((path) => !selected.has(path)))
      )
        context.addIssue({
          code: 'custom',
          message: mergeCommit
            ? 'Merge commits need every displayed fingerprint and selected path'
            : 'Every selected path needs its displayed fingerprint',
          path: ['expected', 'files'],
        });
    }
    if (
      input.action === 'discard' &&
      (paths.length !== 1 || paths[0] !== input.path)
    )
      context.addIssue({
        code: 'custom',
        message: 'Discard needs the displayed fingerprint for its path',
        path: ['expected', 'files'],
      });
    if (input.action.startsWith('stash-') && expected.files === undefined)
      context.addIssue({
        code: 'custom',
        message: 'Stash actions need the displayed change list',
        path: ['expected', 'files'],
      });
    if (
      (input.action === 'fetch' ||
        input.action === 'pull' ||
        input.action === 'push') &&
      expected.upstreamOid === undefined
    )
      context.addIssue({
        code: 'custom',
        message: 'Network actions need the displayed upstream',
        path: ['expected', 'upstreamOid'],
      });
  });

export const gitActionRequestParamsSchema = z.strictObject({
  requestId: z.uuid(),
});

export const gitActionDismissParamsSchema = gitActionScopeSchema.extend({
  requestId: z.uuid(),
});
export const dismissInterruptedResponseSchema = z.strictObject({
  dismissed: z.literal(true),
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

export const gitActionReceiptSchema = z.strictObject({
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
    .strictObject({
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

export const gitActionReceiptOrErrorSchema =
  gitActionReceiptSchema.or(apiErrorSchema);

export type GitActionInput = z.infer<typeof gitActionInputSchema>;
export type GitActionExpectation = z.infer<typeof gitActionExpectationSchema>;
export type RunGitActionRequest = z.infer<typeof runGitActionRequestSchema>;
export type GitActionReceipt = z.infer<typeof gitActionReceiptSchema>;
export type ActionInput = GitActionInput;
export type Expectation = GitActionExpectation;
export type Receipt = GitActionReceipt;
export type GitAction = GitActionInput['action'];

export const branchesResponseSchema = z.strictObject({
  current: z.string().nullable(),
  branches: z.array(
    z.strictObject({
      name: z.string(),
      upstream: z.string().nullable(),
      lastCommitAt: z.string(),
      checkedOutElsewhere: z.boolean(),
    }),
  ),
});
export type BranchesResponse = z.infer<typeof branchesResponseSchema>;

function utf8Size(value: string): number {
  return Array.from(value).reduce((size, character) => {
    const point = character.codePointAt(0) ?? 0;
    if (point <= 0x7f) return size + 1;
    if (point <= 0x7ff) return size + 2;
    return size + (point <= 0xffff ? 3 : 4);
  }, 0);
}
