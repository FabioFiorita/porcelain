import { z } from 'zod';
import { gitPathSchema, gitWorktreeParamsSchema } from './git-status.ts';

/** A lowercase SHA-256 digest of the file state the reviewer saw. */
export const fingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const reviewedMarkSchema = z.strictObject({
  path: gitPathSchema,
  fingerprint: fingerprintSchema,
  reviewedAt: z.string().datetime(),
});

export const reviewedMarksResponseSchema = z.strictObject({
  worktreeId: gitWorktreeParamsSchema.shape.worktreeId,
  marks: z.array(reviewedMarkSchema).max(2000),
});

export const reviewedPathQuerySchema = z.strictObject({ path: gitPathSchema });

export const setReviewedRequestSchema = z.strictObject({
  path: gitPathSchema,
  reviewed: z.literal(true),
  /** The file state currently displayed by the caller. */
  fingerprint: fingerprintSchema,
});

export type ReviewedMark = z.infer<typeof reviewedMarkSchema>;
export type ReviewedMarksResponse = z.infer<typeof reviewedMarksResponseSchema>;
export type SetReviewedRequest = z.infer<typeof setReviewedRequestSchema>;

export const setReviewedBulkRequestSchema = z.strictObject({
  files: z
    .array(
      z.strictObject({
        path: gitPathSchema,
        fingerprint: fingerprintSchema,
      }),
    )
    .min(1)
    .max(2000),
});

export const setReviewedBulkResponseSchema = reviewedMarksResponseSchema.extend(
  {
    marked: z.array(gitPathSchema).max(2000),
    conflicts: z
      .array(
        z.strictObject({
          path: gitPathSchema,
          reason: z.enum(['stale', 'missing']),
        }),
      )
      .max(2000),
  },
);

export type SetReviewedBulkRequest = z.infer<
  typeof setReviewedBulkRequestSchema
>;
export type SetReviewedBulkResponse = z.infer<
  typeof setReviewedBulkResponseSchema
>;

export const reviewedLayerMarkSchema = z.strictObject({
  layerId: z.uuid(),
  fingerprint: fingerprintSchema,
  reviewedAt: z.string().datetime(),
  stale: z.boolean(),
});
export const reviewedLayerMarksResponseSchema = z.strictObject({
  worktreeId: gitWorktreeParamsSchema.shape.worktreeId,
  marks: z.array(reviewedLayerMarkSchema).max(100),
});
export const setReviewedLayerRequestSchema = z.strictObject({
  layerId: z.uuid(),
  reviewed: z.literal(true),
  fingerprint: fingerprintSchema,
});
export const reviewedLayerQuerySchema = z.strictObject({ layerId: z.uuid() });
export type ReviewedLayerMark = z.infer<typeof reviewedLayerMarkSchema>;
export type ReviewedLayerMarksResponse = z.infer<
  typeof reviewedLayerMarksResponseSchema
>;
export type SetReviewedLayerRequest = z.infer<
  typeof setReviewedLayerRequestSchema
>;
