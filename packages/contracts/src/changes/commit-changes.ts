import { Schema } from 'effect';
import {
  COMMIT_FILES,
  COMMIT_PARENTS,
  DIFFS_PER_REQUEST,
  PATHS_PER_CHANGE,
} from '../shared/limits.ts';
import { nullableAsUndefined } from '../shared/schema.ts';
import { oidSchema } from '../shared/oid.ts';
import { worktreeIdSchema } from '../shared/schema.ts';
import { commitSummarySchema } from './commit-history.ts';
import { gitDiffContentSchema } from './git-diff.ts';

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
  paths: Schema.Array(
    Schema.Array(Schema.String)
      .check(Schema.isMinLength(1))
      .check(Schema.isMaxLength(PATHS_PER_CHANGE)),
  )
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(DIFFS_PER_REQUEST)),
});
export const readCommitDiffsResponseSchema = Schema.Struct({
  commitOid: oidSchema,
  diffs: Schema.Array(
    Schema.Struct({
      paths: Schema.Array(Schema.String),
      content: gitDiffContentSchema,
    }),
  ),
});

export type ReadCommitFilesParams = typeof readCommitFilesParamsSchema.Type;
export type ReadCommitFilesQuery = typeof readCommitFilesQuerySchema.Type;
export type ReadCommitFilesResponse = typeof readCommitFilesResponseSchema.Type;
export type ReadCommitDiffsParams = typeof readCommitDiffsParamsSchema.Type;
export type ReadCommitDiffsRequest = typeof readCommitDiffsRequestSchema.Type;
export type ReadCommitDiffsResponse = typeof readCommitDiffsResponseSchema.Type;
