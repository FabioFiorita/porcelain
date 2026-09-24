import { z } from 'zod';
import {
  COMMIT_FILES,
  COMMIT_PARENTS,
  DIFFS_PER_REQUEST,
  PATHS_PER_CHANGE,
} from '../shared/limits.ts';
import { absentAsNull } from '../shared/absent-as-null.ts';
import { oidSchema } from '../shared/oid.ts';
import { worktreeIdSchema } from '../shared/worktree-params.ts';
import { commitSummarySchema } from './commit-history.ts';
import { gitDiffContentSchema } from './git-diff.ts';

const commitComparisonSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('parent'),
    parentNumber: z.number().int().positive(),
    baseOid: oidSchema,
  }),
  z.object({ kind: z.literal('empty-tree') }),
]);

const commitFileSchema = z.object({
  oldPath: absentAsNull(z.string()),
  newPath: absentAsNull(z.string()),
  status: z.enum(['added', 'deleted', 'modified', 'renamed', 'type-changed']),
  oldMode: z.string(),
  newMode: z.string(),
});

export const readCommitFilesParamsSchema = z.strictObject({
  worktreeId: worktreeIdSchema,
  oid: oidSchema,
});
export const readCommitFilesQuerySchema = z.strictObject({
  parent: z.coerce.number().int().min(1).max(COMMIT_PARENTS).optional(),
});
export const readCommitFilesResponseSchema = z.object({
  commit: commitSummarySchema,
  comparison: commitComparisonSchema,
  files: z.array(commitFileSchema).max(COMMIT_FILES),
});

export const readCommitDiffsParamsSchema = z.strictObject({
  worktreeId: worktreeIdSchema,
  oid: oidSchema,
});
export const readCommitDiffsRequestSchema = z.strictObject({
  parent: z.number().int().min(1).max(COMMIT_PARENTS).optional(),
  paths: z
    .array(z.array(z.string()).min(1).max(PATHS_PER_CHANGE))
    .min(1)
    .max(DIFFS_PER_REQUEST),
});
export const readCommitDiffsResponseSchema = z.object({
  commitOid: oidSchema,
  diffs: z.array(
    z.object({ paths: z.array(z.string()), content: gitDiffContentSchema }),
  ),
});

export type ReadCommitFilesParams = z.output<
  typeof readCommitFilesParamsSchema
>;
export type ReadCommitFilesQuery = z.output<typeof readCommitFilesQuerySchema>;
export type ReadCommitFilesResponse = z.output<
  typeof readCommitFilesResponseSchema
>;
export type ReadCommitDiffsParams = z.output<
  typeof readCommitDiffsParamsSchema
>;
export type ReadCommitDiffsRequest = z.output<
  typeof readCommitDiffsRequestSchema
>;
export type ReadCommitDiffsResponse = z.output<
  typeof readCommitDiffsResponseSchema
>;
