import { z } from 'zod';
import { gitChangeSelectionSchema } from './git-status.ts';

export const gitDiffRequestSchema = z.strictObject({
  expectedStatusToken: z.string().regex(/^[a-f0-9]{64}$/),
  change: gitChangeSelectionSchema,
});

export const gitDiffResponseSchema = z.object({
  environmentId: z.uuid(),
  worktreeId: z.uuid(),
  statusToken: z.string().regex(/^[a-f0-9]{64}$/),
  consistency: z.literal('best-effort'),
  change: gitChangeSelectionSchema,
  oldMode: z.string().regex(/^[0-7]{6}$/),
  newMode: z.string().regex(/^[0-7]{6}$/),
  content: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('text'), patch: z.string() }),
    z.object({ kind: z.literal('binary') }),
    z.object({ kind: z.literal('metadata-only'), patch: z.string() }),
    z.object({
      kind: z.literal('omitted'),
      reason: z.enum([
        'size-limit',
        'unsupported-encoding',
        'unsupported-submodule',
      ]),
    }),
  ]),
});

export type GitDiffRequest = z.infer<typeof gitDiffRequestSchema>;
export type GitDiffResponse = z.infer<typeof gitDiffResponseSchema>;
