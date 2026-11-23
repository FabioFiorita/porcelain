import { Schema } from 'effect';
import { COMMIT_FILES, COMMIT_PARENTS } from '../shared/limits.ts';
import { nullableAsUndefined } from '../shared/schema.ts';
import { oidSchema } from '../shared/oid.ts';
import { worktreeIdSchema } from '../shared/schema.ts';
import { commitSummarySchema } from './commit-history.ts';
import { comparisonPathsSchema, comparisonPatchesSchema } from './git-diff.ts';

const commitComparisonSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('parent'),
    parentNumber: Schema.Number.check(Schema.isInt()).check(
      Schema.isGreaterThan(0),
    ),
    baseOid: oidSchema,
  }),
  Schema.Struct({ kind: Schema.Literal('empty-tree') }),
]);

const commitFileSchema = Schema.Struct({
  oldPath: nullableAsUndefined(Schema.String),
  newPath: nullableAsUndefined(Schema.String),
  status: Schema.Literals([
    'added',
    'deleted',
    'modified',
    'renamed',
    'type-changed',
  ]),
  oldMode: Schema.String,
  newMode: Schema.String,
});

export const readCommitFilesParamsSchema = Schema.Struct({
  worktreeId: worktreeIdSchema,
  oid: oidSchema,
});
export const readCommitFilesQuerySchema = Schema.Struct({
  parent: Schema.optional(
    Schema.NumberFromString.check(Schema.isInt())
      .check(Schema.isGreaterThanOrEqualTo(1))
      .check(Schema.isLessThanOrEqualTo(COMMIT_PARENTS)),
  ),
});
export const readCommitFilesResponseSchema = Schema.Struct({
  commit: commitSummarySchema,
  comparison: commitComparisonSchema,
  files: Schema.Array(commitFileSchema).check(Schema.isMaxLength(COMMIT_FILES)),
});

export const readCommitDiffsParamsSchema = Schema.Struct({
  worktreeId: worktreeIdSchema,
  oid: oidSchema,
});
export const readCommitDiffsRequestSchema = Schema.Struct({
  parent: Schema.optional(
    Schema.Number.check(Schema.isInt())
      .check(Schema.isGreaterThanOrEqualTo(1))
      .check(Schema.isLessThanOrEqualTo(COMMIT_PARENTS)),
  ),
  paths: comparisonPathsSchema,
});
export const readCommitDiffsResponseSchema = Schema.Struct({
  commitOid: oidSchema,
  diffs: comparisonPatchesSchema,
});

export type ReadCommitFilesParams = typeof readCommitFilesParamsSchema.Type;
export type ReadCommitFilesQuery = typeof readCommitFilesQuerySchema.Type;
export type ReadCommitFilesResponse = typeof readCommitFilesResponseSchema.Type;
export type ReadCommitDiffsParams = typeof readCommitDiffsParamsSchema.Type;
export type ReadCommitDiffsRequest = typeof readCommitDiffsRequestSchema.Type;
export type ReadCommitDiffsResponse = typeof readCommitDiffsResponseSchema.Type;
