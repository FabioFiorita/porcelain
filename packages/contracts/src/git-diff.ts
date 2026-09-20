import { z } from 'zod';

export const gitDiffContentSchema = z.discriminatedUnion('kind', [
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
]);
