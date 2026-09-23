import { z } from 'zod';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { oidSchema } from '../shared/oid.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { worktreeIdSchema } from '../shared/worktree-params.ts';
import { gitDiffContentSchema } from './git-diff.ts';
import { gitChangeSchema, gitChangeSelectionSchema } from './git-status.ts';

// Duplicated from git-actions/git-actions.ts so this folder imports only shared.
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

export const fileChangeSchema = z.object({
  path: relativePathSchema,
  fingerprint: fingerprintSchema.nullable(),
  comparisons: z.array(gitChangeSchema).min(1),
});

export const changeListBranchSchema = z.object({
  name: z.string().nullable(),
  upstream: z.string().nullable(),
  ahead: z.number().int().nonnegative(),
  behind: z.number().int().nonnegative(),
});

export const readChangesResponseSchema = z.object({
  environmentId: z.uuid(),
  worktreeId: worktreeIdSchema,
  statusToken: fingerprintSchema,
  headOid: oidSchema.nullable(),
  inProgress: z.enum(['merge', 'rebase']).nullable(),
  mergeHeadOid: oidSchema.nullable(),
  branch: changeListBranchSchema.nullable(),
  interrupted: z
    .object({
      requestId: z.uuid(),
      action: gitActionSchema,
      gitState: z.string(),
    })
    .optional(),
  changes: z.array(fileChangeSchema).max(2000),
});

export const readChangeDiffsRequestSchema = z.strictObject({
  expectedStatusToken: fingerprintSchema,
  expectedFiles: z
    .array(
      z.strictObject({
        path: relativePathSchema,
        fingerprint: fingerprintSchema.nullable(),
      }),
    )
    .min(1)
    .max(200),
  selections: z.array(gitChangeSelectionSchema).min(1).max(200),
});

export const readChangeDiffsResponseSchema = z.object({
  environmentId: z.uuid(),
  worktreeId: worktreeIdSchema,
  statusToken: fingerprintSchema,
  diffs: z.array(
    z.object({
      selection: gitChangeSelectionSchema,
      content: gitDiffContentSchema,
    }),
  ),
});

export const readChangeLinesQuerySchema = z.strictObject({
  path: relativePathSchema,
  from: z.coerce.number().int().min(1),
  to: z.coerce.number().int().min(1),
  at: z.enum(['head', 'worktree']),
});

export const readChangeLinesResponseSchema = z.object({
  environmentId: z.uuid(),
  worktreeId: worktreeIdSchema,
  at: z.enum(['head', 'worktree']),
  path: relativePathSchema,
  from: z.number().int().nonnegative(),
  to: z.number().int().nonnegative(),
  lines: z.array(z.string()),
});

export type GitAction = z.output<typeof gitActionSchema>;
export type FileChange = z.output<typeof fileChangeSchema>;
export type ChangeListBranch = z.output<typeof changeListBranchSchema>;
export type ReadChangesResponse = z.output<typeof readChangesResponseSchema>;
export type ReadChangeDiffsRequest = z.output<
  typeof readChangeDiffsRequestSchema
>;
export type ReadChangeDiffsResponse = z.output<
  typeof readChangeDiffsResponseSchema
>;
export type ReadChangeLinesQuery = z.output<typeof readChangeLinesQuerySchema>;
export type ReadChangeLinesResponse = z.output<
  typeof readChangeLinesResponseSchema
>;
