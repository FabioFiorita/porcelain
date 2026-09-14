import { z } from 'zod';
import { gitPathSchema } from './git-status.ts';
export const commitModelsSchema = z.array(
  z.strictObject({ id: z.string(), label: z.string() }),
);
export const commitDraftRequestSchema = z.strictObject({
  mode: z.enum(['message', 'groups']),
  model: z.string().min(1).max(160),
  expectedStatusToken: z.string().regex(/^[a-f0-9]{64}$/),
  paths: z.array(gitPathSchema).min(1).max(2000),
});
export const commitDraftResponseSchema = z.strictObject({
  groups: z
    .array(
      z.strictObject({
        message: z.string().min(1).max(16384),
        paths: z.array(gitPathSchema).min(1).max(2000),
      }),
    )
    .min(1)
    .max(20),
  expectedFiles: z
    .array(
      z.strictObject({
        path: gitPathSchema,
        fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .max(2000),
});
