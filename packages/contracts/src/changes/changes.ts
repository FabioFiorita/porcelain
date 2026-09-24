import { z } from 'zod';
import { absentAsNull } from '../shared/absent-as-null.ts';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { gitActionSchema } from '../shared/git-action-receipt.ts';
import { oidSchema } from '../shared/oid.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { worktreeIdSchema } from '../shared/worktree-params.ts';
import { gitDiffContentSchema } from './git-diff.ts';
import { gitChangeSchema, gitChangeSelectionSchema } from './git-status.ts';

export const fileChangeSchema = z.object({
  path: relativePathSchema,
  fingerprint: absentAsNull(fingerprintSchema),
  comparisons: z.array(gitChangeSchema).min(1),
});

export const changeListBranchSchema = z.object({
  name: absentAsNull(z.string()),
  upstream: absentAsNull(z.string()),
  ahead: z.number().int().nonnegative(),
  behind: z.number().int().nonnegative(),
});

export const readChangesResponseSchema = z.object({
  environmentId: z.uuid(),
  worktreeId: worktreeIdSchema,
  statusToken: fingerprintSchema,
  headOid: absentAsNull(oidSchema),
  inProgress: absentAsNull(z.enum(['merge', 'rebase'])),
  mergeHeadOid: absentAsNull(oidSchema),
  branch: absentAsNull(changeListBranchSchema),
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
        fingerprint: absentAsNull(fingerprintSchema),
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

export const readChangeLinesQuerySchema = z
  .strictObject({
    path: relativePathSchema,
    from: z.coerce.number().int().min(1),
    to: z.coerce.number().int().min(1),
    at: z.enum(['head', 'worktree']),
  })
  .refine((range) => range.to >= range.from);

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
