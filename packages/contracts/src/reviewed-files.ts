import { z } from 'zod';
import { gitPathSchema, gitWorktreeParamsSchema } from './git-status.ts';

/** A lowercase SHA-256 digest of the evidence the reviewer saw. */
export const evidenceFingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const reviewedMarkSchema = z.strictObject({
  path: gitPathSchema,
  fingerprint: evidenceFingerprintSchema,
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
  /** The evidence currently displayed by the caller. */
  fingerprint: evidenceFingerprintSchema,
});

export type ReviewedMark = z.infer<typeof reviewedMarkSchema>;
export type ReviewedMarksResponse = z.infer<typeof reviewedMarksResponseSchema>;
export type SetReviewedRequest = z.infer<typeof setReviewedRequestSchema>;

export const reviewSummarySchema = z.strictObject({
  worktreeId: gitWorktreeParamsSchema.shape.worktreeId,
  pendingFiles: z.number().int().nonnegative(),
  openThreads: z.number().int().nonnegative(),
});
export type ReviewSummary = z.infer<typeof reviewSummarySchema>;
