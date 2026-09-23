import { z } from 'zod';
import { commitOidSchema, commitSummarySchema } from './commit-history.ts';
import { gitDiffContentSchema } from './git-diff.ts';
import { worktreeIdSchema } from './worktree-id.ts';

export const commitFilesParamsSchema = z.strictObject({
  worktreeId: worktreeIdSchema,
  oid: commitOidSchema,
});
export const commitFilesQuerySchema = z.strictObject({
  parent: z.coerce.number().int().min(1).max(1000).optional(),
});
const commitComparisonSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('parent'),
    parentNumber: z.number().int().positive(),
    baseOid: commitOidSchema,
  }),
  z.object({ kind: z.literal('empty-tree') }),
]);
export const commitFileSchema = z.object({
  oldPath: z.string().nullable(),
  newPath: z.string().nullable(),
  status: z.enum(['added', 'deleted', 'modified', 'renamed', 'type-changed']),
  oldMode: z.string(),
  newMode: z.string(),
});
export const commitFilesResponseSchema = z.object({
  commit: commitSummarySchema,
  comparison: commitComparisonSchema,
  files: z.array(commitFileSchema).max(10_000),
});
export const commitDiffsRequestSchema = z.strictObject({
  parent: z.number().int().min(1).max(1000).optional(),
  paths: z.array(z.array(z.string()).min(1).max(2)).min(1).max(200),
});
export const commitDiffsResponseSchema = z.object({
  commitOid: commitOidSchema,
  diffs: z.array(
    z.object({ paths: z.array(z.string()), content: gitDiffContentSchema }),
  ),
});
export type CommitFilesResponse = z.infer<typeof commitFilesResponseSchema>;
export type CommitDiffsResponse = z.infer<typeof commitDiffsResponseSchema>;
