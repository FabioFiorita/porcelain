import { Schema } from 'effect';
import { nullableAsUndefined } from '../shared/schema.ts';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { gitActionSchema } from '../shared/git-action-receipt.ts';
import { oidSchema } from '../shared/oid.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { worktreeIdSchema } from '../shared/schema.ts';
import { gitDiffContentSchema } from './git-diff.ts';
import { gitChangeSchema, gitChangeSelectionSchema } from './git-status.ts';
import { CHANGED_PATHS, DIFFS_PER_REQUEST } from '../shared/limits.ts';

const fileChangeSchema = Schema.Struct({
  path: relativePathSchema,
  fingerprint: nullableAsUndefined(fingerprintSchema),
  comparisons: Schema.Array(gitChangeSchema).check(Schema.isMinLength(1)),
});

const changeListBranchSchema = Schema.Struct({
  name: nullableAsUndefined(Schema.String),
  upstream: nullableAsUndefined(Schema.String),
  ahead: Schema.Number.check(Schema.isInt()).check(
    Schema.isGreaterThanOrEqualTo(0),
  ),
  behind: Schema.Number.check(Schema.isInt()).check(
    Schema.isGreaterThanOrEqualTo(0),
  ),
});

export const readChangesResponseSchema = Schema.Struct({
  environmentId: Schema.String.check(Schema.isUUID()),
  worktreeId: worktreeIdSchema,
  statusToken: fingerprintSchema,
  headOid: nullableAsUndefined(oidSchema),
  inProgress: nullableAsUndefined(Schema.Literals(['merge', 'rebase'])),
  mergeHeadOid: nullableAsUndefined(oidSchema),
  branch: nullableAsUndefined(changeListBranchSchema),
  interrupted: Schema.optional(
    Schema.Struct({
      requestId: Schema.String.check(Schema.isUUID()),
      action: gitActionSchema,
    }),
  ),
  changes: Schema.Array(fileChangeSchema).check(
    Schema.isMaxLength(CHANGED_PATHS),
  ),
});

export const readChangeDiffsRequestSchema = Schema.Struct({
  expectedStatusToken: fingerprintSchema,
  expectedFiles: Schema.Array(
    Schema.Struct({
      path: relativePathSchema,
      fingerprint: nullableAsUndefined(fingerprintSchema),
    }),
  )
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(DIFFS_PER_REQUEST)),
  selections: Schema.Array(gitChangeSelectionSchema)
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(DIFFS_PER_REQUEST)),
});

export const readChangeDiffsResponseSchema = Schema.Struct({
  environmentId: Schema.String.check(Schema.isUUID()),
  worktreeId: worktreeIdSchema,
  statusToken: fingerprintSchema,
  diffs: Schema.Array(
    Schema.Struct({
      selection: gitChangeSelectionSchema,
      content: gitDiffContentSchema,
    }),
  ),
});

export const readChangeLinesQuerySchema = Schema.Struct({
  path: relativePathSchema,
  from: Schema.NumberFromString.check(Schema.isInt()).check(
    Schema.isGreaterThanOrEqualTo(1),
  ),
  to: Schema.NumberFromString.check(Schema.isInt()).check(
    Schema.isGreaterThanOrEqualTo(1),
  ),
  at: Schema.Literals(['head', 'worktree']),
});

export const readChangeLinesResponseSchema = Schema.Struct({
  environmentId: Schema.String.check(Schema.isUUID()),
  worktreeId: worktreeIdSchema,
  at: Schema.Literals(['head', 'worktree']),
  path: relativePathSchema,
  from: Schema.Number.check(Schema.isInt()).check(
    Schema.isGreaterThanOrEqualTo(0),
  ),
  to: Schema.Number.check(Schema.isInt()).check(
    Schema.isGreaterThanOrEqualTo(0),
  ),
  lines: Schema.Array(Schema.String),
});

export type ReadChangesResponse = typeof readChangesResponseSchema.Type;
export type ReadChangeDiffsRequest = typeof readChangeDiffsRequestSchema.Type;
export type ReadChangeDiffsResponse = typeof readChangeDiffsResponseSchema.Type;
export type ReadChangeLinesQuery = typeof readChangeLinesQuerySchema.Type;
export type ReadChangeLinesResponse = typeof readChangeLinesResponseSchema.Type;
