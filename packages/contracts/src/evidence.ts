import { z } from 'zod';
import { gitDiffContentSchema } from './git-diff.ts';
import {
  gitChangeSchema,
  gitPathSchema,
  gitWorktreeParamsSchema,
} from './git-status.ts';

const evidenceFileSchema = z.strictObject({
  kind: z.literal('file'),
  encoding: z.literal('utf-8'),
  byteLength: z.number().int().nonnegative(),
  text: z.string(),
});

const evidenceOmissionSchema = z.strictObject({
  kind: z.literal('omitted'),
  reason: z.enum([
    'binary',
    'conflict',
    'content-changed',
    'size-limit',
    'unsupported-encoding',
    'unsupported-git-entry',
    'unsupported-submodule',
    'unreadable',
  ]),
});

export const evidenceContentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('diff'), content: gitDiffContentSchema }),
  evidenceFileSchema,
  evidenceOmissionSchema,
]);

export const evidenceComparisonSchema = z.strictObject({
  change: gitChangeSchema,
  content: evidenceContentSchema,
});

export const reviewEvidenceSchema = z.strictObject({
  /** A rename uses its new path; deletions use their old path. */
  path: gitPathSchema,
  /** Null means at least one comparison cannot be safely reviewed. */
  fingerprint: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  comparisons: z.array(evidenceComparisonSchema).min(1),
});

export const evidenceResponseSchema = z.strictObject({
  environmentId: z.uuid(),
  worktreeId: gitWorktreeParamsSchema.shape.worktreeId,
  statusToken: z.string().regex(/^[a-f0-9]{64}$/),
  consistency: z.literal('best-effort'),
  evidence: z.array(reviewEvidenceSchema).max(2000),
});

export type EvidenceContent = z.infer<typeof evidenceContentSchema>;
export type EvidenceComparison = z.infer<typeof evidenceComparisonSchema>;
export type ReviewEvidence = z.infer<typeof reviewEvidenceSchema>;
export type EvidenceResponse = z.infer<typeof evidenceResponseSchema>;
