import { z } from 'zod';

export const readHealthResponseSchema = z.object({
  status: z.literal('ok'),
  environmentId: z.string(),
});

export type ReadHealthResponse = z.output<typeof readHealthResponseSchema>;
