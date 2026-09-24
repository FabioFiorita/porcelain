import { z } from 'zod';
import { absentAsNull } from '../shared/absent-as-null.ts';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { gitActionSchema } from '../shared/git-action-receipt.ts';
import { oidSchema } from '../shared/oid.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { worktreeIdSchema } from '../shared/worktree-params.ts';
import { gitDiffContentSchema } from './git-diff.ts';
import { gitChangeSchema, gitChangeSelectionSchema } from './git-status.ts';
import { CHANGED_PATHS } from '../shared/limits.ts';

const fileChangeSchema = z.object({
  path: relativePathSchema,
  fingerprint: absentAsNull(fingerprintSchema),
  comparisons: z.array(gitChangeSchema).min(1),
});

const changeListBranchSchema = z.object({
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
    })
    .optional(),
  changes: z.array(fileChangeSchema).max(CHANGED_PATHS),
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
