import { z } from 'zod';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { relativePathSchema } from '../shared/relative-path.ts';

export const listCommitModelsResponseSchema = z.array(
  z.object({ id: z.string(), label: z.string() }),
);

export const generateCommitDraftRequestSchema = z.strictObject({
  mode: z.enum(['message', 'groups']),
  model: z.string().min(1).max(160),
  expectedStatusToken: fingerprintSchema,
  paths: z.array(relativePathSchema).min(1).max(2000),
});
export const generateCommitDraftResponseSchema = z.object({
  groups: z
    .array(
      z.object({
        message: z.string().min(1).max(16384),
        paths: z.array(relativePathSchema).min(1).max(2000),
      }),
    )
    .min(1)
    .max(20),
  expectedFiles: z
    .array(
      z.object({ path: relativePathSchema, fingerprint: fingerprintSchema }),
    )
    .max(2000),
});

export type ListCommitModelsResponse = z.output<
  typeof listCommitModelsResponseSchema
>;
export type GenerateCommitDraftRequest = z.output<
  typeof generateCommitDraftRequestSchema
>;
export type GenerateCommitDraftResponse = z.output<
  typeof generateCommitDraftResponseSchema
>;
