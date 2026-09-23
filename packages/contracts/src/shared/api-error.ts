import { z } from 'zod';

export const apiErrorSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  error: z.string(),
  message: z.string(),
});

export type ApiError = z.output<typeof apiErrorSchema>;
