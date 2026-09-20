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
