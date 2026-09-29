import { z } from 'zod';
import { branchRefSchema } from '../shared/branch-ref.ts';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { worktreeIdSchema } from '../shared/worktree-params.ts';
import { REVIEWED_FILE_MARKS, REVIEWED_LAYER_MARKS } from '../shared/limits.ts';

const reviewedMarkSchema = z.object({
  path: relativePathSchema,
  fingerprint: fingerprintSchema,
  reviewedAt: z.iso.datetime(),
});

const reviewedScopeSchema = z.enum(['worktree', 'branch']);
const branchScope = {
  scope: z.literal('branch'),
  base: branchRefSchema,
};

export const listReviewedFilesQuerySchema = z.strictObject({
  scope: reviewedScopeSchema.optional(),
});
export const listReviewedFilesResponseSchema = z.object({
  worktreeId: worktreeIdSchema,
  marks: z.array(reviewedMarkSchema).max(REVIEWED_FILE_MARKS),
});

const reviewedFileShape = {
  path: relativePathSchema,
  reviewed: z.literal(true),
  fingerprint: fingerprintSchema,
};
export const setReviewedFileRequestSchema = z.union([
  z.strictObject({
    ...reviewedFileShape,
    scope: z.literal('worktree').optional(),
  }),
  z.strictObject({ ...reviewedFileShape, ...branchScope }),
]);
export const setReviewedFileResponseSchema = listReviewedFilesResponseSchema;

const reviewedFilesShape = {
  files: z
    .array(
      z.strictObject({
        path: relativePathSchema,
        fingerprint: fingerprintSchema,
      }),
    )
    .min(1)
    .max(REVIEWED_FILE_MARKS),
};
export const setReviewedFilesRequestSchema = z.union([
  z.strictObject({
    ...reviewedFilesShape,
    scope: z.literal('worktree').optional(),
  }),
  z.strictObject({ ...reviewedFilesShape, ...branchScope }),
]);
export const setReviewedFilesResponseSchema =
  listReviewedFilesResponseSchema.extend({
    marked: z.array(relativePathSchema).max(REVIEWED_FILE_MARKS),
    conflicts: z
      .array(
        z.object({
          path: relativePathSchema,
          reason: z.enum(['stale', 'missing']),
        }),
      )
      .max(REVIEWED_FILE_MARKS),
  });

export const removeReviewedFileQuerySchema = z.strictObject({
  path: relativePathSchema,
  scope: reviewedScopeSchema.optional(),
});
export const removeReviewedFileResponseSchema = listReviewedFilesResponseSchema;

export const removeReviewedFilesRequestSchema = z.strictObject({
  paths: z.array(relativePathSchema).min(1).max(REVIEWED_FILE_MARKS),
  scope: reviewedScopeSchema.optional(),
});
export const removeReviewedFilesResponseSchema =
  listReviewedFilesResponseSchema;

const reviewedLayerMarkSchema = z.object({
  layerId: z.uuid(),
  fingerprint: fingerprintSchema,
  reviewedAt: z.iso.datetime(),
  stale: z.boolean(),
});

export const listReviewedLayersResponseSchema = z.object({
  worktreeId: worktreeIdSchema,
  marks: z.array(reviewedLayerMarkSchema).max(REVIEWED_LAYER_MARKS),
});

export const setReviewedLayerRequestSchema = z.strictObject({
  layerId: z.uuid(),
  reviewed: z.literal(true),
  fingerprint: fingerprintSchema,
});
export const setReviewedLayerResponseSchema = listReviewedLayersResponseSchema;

export const removeReviewedLayerQuerySchema = z.strictObject({
  layerId: z.uuid(),
});
export const removeReviewedLayerResponseSchema =
  listReviewedLayersResponseSchema;

export type ListReviewedFilesQuery = z.output<
  typeof listReviewedFilesQuerySchema
>;
export type ListReviewedFilesResponse = z.output<
  typeof listReviewedFilesResponseSchema
>;
export type SetReviewedFileRequest = z.output<
  typeof setReviewedFileRequestSchema
>;
export type ReviewedFileConflictPolicy = { onConflict: 'report' | 'refuse' };
export type SetReviewedFilesRequest = z.output<
  typeof setReviewedFilesRequestSchema
>;
export type SetReviewedFilesResponse = z.output<
  typeof setReviewedFilesResponseSchema
>;
export type RemoveReviewedFileQuery = z.output<
  typeof removeReviewedFileQuerySchema
>;
export type RemoveReviewedFilesRequest = z.output<
  typeof removeReviewedFilesRequestSchema
>;
export type RemoveReviewedFilesResponse = z.output<
  typeof removeReviewedFilesResponseSchema
>;
export type ListReviewedLayersResponse = z.output<
  typeof listReviewedLayersResponseSchema
>;
export type SetReviewedLayerRequest = z.output<
  typeof setReviewedLayerRequestSchema
>;
export type SetReviewedLayerResponse = z.output<
  typeof setReviewedLayerResponseSchema
>;
export type RemoveReviewedLayerQuery = z.output<
  typeof removeReviewedLayerQuerySchema
>;
export type RemoveReviewedLayerResponse = z.output<
  typeof removeReviewedLayerResponseSchema
>;
