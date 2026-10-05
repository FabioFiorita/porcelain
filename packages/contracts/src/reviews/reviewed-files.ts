import { isoDateTimeSchema } from '../shared/schema.ts';
import { Schema } from 'effect';
import { branchRefSchema } from '../shared/branch-ref.ts';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { worktreeIdSchema } from '../shared/schema.ts';
import {
  REVIEWED_BRANCH_FILE_MARKS,
  REVIEWED_FILE_MARKS,
  REVIEWED_LAYER_MARKS,
} from '../shared/limits.ts';

const reviewedMarkSchema = Schema.Struct({
  path: relativePathSchema,
  fingerprint: fingerprintSchema,
  reviewedAt: isoDateTimeSchema,
});

const reviewedScopeSchema = Schema.Literals(['worktree', 'branch']);
const branchScope = {
  scope: Schema.Literal('branch'),
  base: branchRefSchema,
};

export const listReviewedFilesQuerySchema = Schema.Struct({
  scope: Schema.optional(reviewedScopeSchema),
  branch: Schema.optional(branchRefSchema),
});
export const listReviewedFilesResponseSchema = Schema.Struct({
  worktreeId: worktreeIdSchema,
  marks: Schema.Array(reviewedMarkSchema).check(
    Schema.isMaxLength(REVIEWED_BRANCH_FILE_MARKS),
  ),
});

const reviewedFileShape = {
  path: relativePathSchema,
  reviewed: Schema.Literal(true),
  fingerprint: fingerprintSchema,
};
export const setReviewedFileRequestSchema = Schema.Union([
  Schema.Struct({
    ...reviewedFileShape,
    scope: Schema.optional(Schema.Literal('worktree')),
  }),
  Schema.Struct({ ...reviewedFileShape, ...branchScope }),
]);
export const setReviewedFileResponseSchema = listReviewedFilesResponseSchema;

const reviewedFilesShape = {
  files: Schema.Array(
    Schema.Struct({
      path: relativePathSchema,
      fingerprint: fingerprintSchema,
    }),
  )
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(REVIEWED_FILE_MARKS)),
};
export const setReviewedFilesRequestSchema = Schema.Union([
  Schema.Struct({
    ...reviewedFilesShape,
    scope: Schema.optional(Schema.Literal('worktree')),
  }),
  Schema.Struct({ ...reviewedFilesShape, ...branchScope }),
]);
export const setReviewedFilesResponseSchema = Schema.Struct({
  ...listReviewedFilesResponseSchema.fields,
  ...{
    marked: Schema.Array(relativePathSchema).check(
      Schema.isMaxLength(REVIEWED_FILE_MARKS),
    ),
    conflicts: Schema.Array(
      Schema.Struct({
        path: relativePathSchema,
        reason: Schema.Literals(['stale', 'missing']),
      }),
    ).check(Schema.isMaxLength(REVIEWED_FILE_MARKS)),
  },
});

export const removeReviewedFileQuerySchema = Schema.Struct({
  path: relativePathSchema,
  scope: Schema.optional(reviewedScopeSchema),
  branch: Schema.optional(branchRefSchema),
});
export const removeReviewedFileResponseSchema = listReviewedFilesResponseSchema;

export const removeReviewedFilesRequestSchema = Schema.Struct({
  paths: Schema.Array(relativePathSchema)
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(REVIEWED_FILE_MARKS)),
  scope: Schema.optional(reviewedScopeSchema),
  branch: Schema.optional(branchRefSchema),
});
export const removeReviewedFilesResponseSchema =
  listReviewedFilesResponseSchema;

const reviewedLayerMarkSchema = Schema.Struct({
  layerId: Schema.String.check(Schema.isUUID()),
  fingerprint: fingerprintSchema,
  reviewedAt: isoDateTimeSchema,
  stale: Schema.Boolean,
});

export const listReviewedLayersResponseSchema = Schema.Struct({
  worktreeId: worktreeIdSchema,
  marks: Schema.Array(reviewedLayerMarkSchema).check(
    Schema.isMaxLength(REVIEWED_LAYER_MARKS),
  ),
});

export const setReviewedLayerRequestSchema = Schema.Struct({
  layerId: Schema.String.check(Schema.isUUID()),
  reviewed: Schema.Literal(true),
  fingerprint: fingerprintSchema,
});
export const setReviewedLayerResponseSchema = listReviewedLayersResponseSchema;

export const removeReviewedLayerQuerySchema = Schema.Struct({
  layerId: Schema.String.check(Schema.isUUID()),
});
export const removeReviewedLayerResponseSchema =
  listReviewedLayersResponseSchema;

export type ListReviewedFilesQuery = typeof listReviewedFilesQuerySchema.Type;
export type ListReviewedFilesResponse =
  typeof listReviewedFilesResponseSchema.Type;
export type SetReviewedFileRequest = typeof setReviewedFileRequestSchema.Type;
export type ReviewedFileConflictPolicy = { onConflict: 'report' | 'refuse' };
export type SetReviewedFilesRequest = typeof setReviewedFilesRequestSchema.Type;
export type SetReviewedFilesResponse =
  typeof setReviewedFilesResponseSchema.Type;
export type RemoveReviewedFileQuery = typeof removeReviewedFileQuerySchema.Type;
export type RemoveReviewedFilesRequest =
  typeof removeReviewedFilesRequestSchema.Type;
export type RemoveReviewedFilesResponse =
  typeof removeReviewedFilesResponseSchema.Type;
export type ListReviewedLayersResponse =
  typeof listReviewedLayersResponseSchema.Type;
export type SetReviewedLayerRequest = typeof setReviewedLayerRequestSchema.Type;
export type SetReviewedLayerResponse =
  typeof setReviewedLayerResponseSchema.Type;
export type RemoveReviewedLayerQuery =
  typeof removeReviewedLayerQuerySchema.Type;
export type RemoveReviewedLayerResponse =
  typeof removeReviewedLayerResponseSchema.Type;
