import { Schema } from 'effect';
import {
  BRANCH_BASES,
  COMMIT_FILES,
  DIFFS_PER_REQUEST,
  PATHS_PER_CHANGE,
} from '../shared/limits.ts';
import { nullableAsUndefined } from '../shared/schema.ts';
import { branchRefSchema } from '../shared/branch-ref.ts';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { oidSchema } from '../shared/oid.ts';
import { worktreeIdSchema } from '../shared/schema.ts';
import { gitDiffContentSchema } from './git-diff.ts';

const branchBaseSchema = Schema.Struct({ ref: Schema.String, oid: oidSchema });

const branchFileSchema = Schema.Struct({
  path: Schema.String,
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
  fingerprint: fingerprintSchema,
});

export const readBranchChangesQuerySchema = Schema.Struct({
  base: Schema.optional(branchRefSchema),
});
export const readBranchChangesResponseSchema = Schema.Struct({
  worktreeId: worktreeIdSchema,
  head: Schema.Struct({
    oid: oidSchema,
    branch: nullableAsUndefined(Schema.String),
  }),
  base: nullableAsUndefined(branchBaseSchema),
  mergeBaseOid: nullableAsUndefined(oidSchema),
  commits: Schema.Number.check(Schema.isInt()).check(
    Schema.isGreaterThanOrEqualTo(0),
  ),
  files: Schema.Array(branchFileSchema).check(Schema.isMaxLength(COMMIT_FILES)),
});

export const readBranchDiffsRequestSchema = Schema.Struct({
  baseOid: oidSchema,
  headOid: oidSchema,
  paths: Schema.Array(
    Schema.Array(Schema.String)
      .check(Schema.isMinLength(1))
      .check(Schema.isMaxLength(PATHS_PER_CHANGE)),
  )
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(DIFFS_PER_REQUEST)),
});
export const readBranchDiffsResponseSchema = Schema.Struct({
  diffs: Schema.Array(
    Schema.Struct({
      paths: Schema.Array(Schema.String),
      content: gitDiffContentSchema,
    }),
  ),
});

export const listBranchBasesResponseSchema = Schema.Struct({
  defaultRef: nullableAsUndefined(Schema.String),
  bases: Schema.Array(
    Schema.Struct({
      ref: Schema.String,
      name: Schema.String,
      remote: Schema.Boolean,
    }),
  ).check(Schema.isMaxLength(BRANCH_BASES)),
});

export type ReadBranchChangesQuery = typeof readBranchChangesQuerySchema.Type;
export type ReadBranchChangesResponse =
  typeof readBranchChangesResponseSchema.Type;
export type ReadBranchDiffsRequest = typeof readBranchDiffsRequestSchema.Type;
export type ReadBranchDiffsResponse = typeof readBranchDiffsResponseSchema.Type;
export type ListBranchBasesResponse = typeof listBranchBasesResponseSchema.Type;
