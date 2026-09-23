import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  environmentId: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
