import { z } from 'zod';
import {
  BRANCH_BASES,
  COMMIT_FILES,
  DIFFS_PER_REQUEST,
  PATHS_PER_CHANGE,
} from '../shared/limits.ts';
import { absentAsNull } from '../shared/absent-as-null.ts';
import { branchRefSchema } from '../shared/branch-ref.ts';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { oidSchema } from '../shared/oid.ts';
import { worktreeIdSchema } from '../shared/worktree-params.ts';
import { gitDiffContentSchema } from './git-diff.ts';

const branchBaseSchema = z.object({ ref: z.string(), oid: oidSchema });

const branchFileSchema = z.object({
  path: z.string(),
  oldPath: absentAsNull(z.string()),
  newPath: absentAsNull(z.string()),
  status: z.enum(['added', 'deleted', 'modified', 'renamed', 'type-changed']),
  oldMode: z.string(),
  newMode: z.string(),
  fingerprint: fingerprintSchema,
});

export const readBranchChangesQuerySchema = z.strictObject({
  base: branchRefSchema.optional(),
});
export const readBranchChangesResponseSchema = z.object({
  worktreeId: worktreeIdSchema,
  head: z.object({ oid: oidSchema, branch: absentAsNull(z.string()) }),
  base: absentAsNull(branchBaseSchema),
  mergeBaseOid: absentAsNull(oidSchema),
  commits: z.number().int().nonnegative(),
  files: z.array(branchFileSchema).max(COMMIT_FILES),
});

export const readBranchDiffsRequestSchema = z.strictObject({
  baseOid: oidSchema,
  headOid: oidSchema,
  paths: z
    .array(z.array(z.string()).min(1).max(PATHS_PER_CHANGE))
    .min(1)
    .max(DIFFS_PER_REQUEST),
});
export const readBranchDiffsResponseSchema = z.object({
  diffs: z.array(
    z.object({ paths: z.array(z.string()), content: gitDiffContentSchema }),
  ),
});

export const listBranchBasesResponseSchema = z.object({
  defaultRef: absentAsNull(z.string()),
  bases: z
    .array(z.object({ ref: z.string(), name: z.string(), remote: z.boolean() }))
    .max(BRANCH_BASES),
});

export type ReadBranchChangesQuery = z.output<
  typeof readBranchChangesQuerySchema
>;
export type ReadBranchChangesResponse = z.output<
  typeof readBranchChangesResponseSchema
>;
export type ReadBranchDiffsRequest = z.output<
  typeof readBranchDiffsRequestSchema
>;
export type ReadBranchDiffsResponse = z.output<
  typeof readBranchDiffsResponseSchema
>;
export type ListBranchBasesResponse = z.output<
  typeof listBranchBasesResponseSchema
>;
