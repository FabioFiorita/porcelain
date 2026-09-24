import { z } from 'zod';
import { fingerprintSchema } from '../shared/fingerprint.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import {
  CHANGED_PATHS,
  COMMIT_GROUPS,
  COMMIT_MESSAGE_BYTES,
} from '../shared/limits.ts';

export const listCommitModelsResponseSchema = z.array(
  z.object({ id: z.string(), label: z.string() }),
);

export const generateCommitDraftRequestSchema = z.strictObject({
  mode: z.enum(['message', 'groups']),
  model: z.string().min(1).max(160),
  expectedStatusToken: fingerprintSchema,
  paths: z.array(relativePathSchema).min(1).max(CHANGED_PATHS),
});
export const generateCommitDraftResponseSchema = z.object({
  groups: z
    .array(
      z.object({
        message: z.string().min(1).max(COMMIT_MESSAGE_BYTES),
        paths: z.array(relativePathSchema).min(1).max(CHANGED_PATHS),
      }),
    )
    .min(1)
    .max(COMMIT_GROUPS),
  expectedFiles: z
    .array(
      z.object({ path: relativePathSchema, fingerprint: fingerprintSchema }),
    )
    .max(CHANGED_PATHS),
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
