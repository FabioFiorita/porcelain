import { z } from 'zod';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { worktreeIdSchema } from '../shared/worktree-params.ts';

export const reviewedMarkSchema = z.object({
  path: relativePathSchema,
  fingerprint: fingerprintSchema,
  reviewedAt: z.iso.datetime(),
});

export const listReviewedFilesResponseSchema = z.object({
  worktreeId: worktreeIdSchema,
  marks: z.array(reviewedMarkSchema).max(2000),
});

export const setReviewedFileRequestSchema = z.strictObject({
  path: relativePathSchema,
  reviewed: z.literal(true),
  fingerprint: fingerprintSchema,
});
export const setReviewedFileResponseSchema = listReviewedFilesResponseSchema;

export const setReviewedFilesRequestSchema = z.strictObject({
  files: z
    .array(
      z.strictObject({
        path: relativePathSchema,
        fingerprint: fingerprintSchema,
      }),
    )
    .min(1)
    .max(2000),
});
export const setReviewedFilesResponseSchema =
  listReviewedFilesResponseSchema.extend({
    marked: z.array(relativePathSchema).max(2000),
    conflicts: z
      .array(
        z.object({
          path: relativePathSchema,
          reason: z.enum(['stale', 'missing']),
        }),
      )
      .max(2000),
  });

export const removeReviewedFileQuerySchema = z.strictObject({
  path: relativePathSchema,
});
export const removeReviewedFileResponseSchema = listReviewedFilesResponseSchema;

export const reviewedLayerMarkSchema = z.object({
  layerId: z.uuid(),
  fingerprint: fingerprintSchema,
  reviewedAt: z.iso.datetime(),
  stale: z.boolean(),
});

export const listReviewedLayersResponseSchema = z.object({
  worktreeId: worktreeIdSchema,
  marks: z.array(reviewedLayerMarkSchema).max(100),
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

export type ReviewedMark = z.output<typeof reviewedMarkSchema>;
export type ListReviewedFilesResponse = z.output<
  typeof listReviewedFilesResponseSchema
>;
export type SetReviewedFileRequest = z.output<
  typeof setReviewedFileRequestSchema
>;
export type SetReviewedFileResponse = z.output<
  typeof setReviewedFileResponseSchema
>;
export type SetReviewedFilesRequest = z.output<
  typeof setReviewedFilesRequestSchema
>;
export type SetReviewedFilesResponse = z.output<
  typeof setReviewedFilesResponseSchema
>;
export type RemoveReviewedFileQuery = z.output<
  typeof removeReviewedFileQuerySchema
>;
export type RemoveReviewedFileResponse = z.output<
  typeof removeReviewedFileResponseSchema
>;
export type ReviewedLayerMark = z.output<typeof reviewedLayerMarkSchema>;
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
