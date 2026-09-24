import { z } from 'zod';
import { ERROR_STATUS_MAX, ERROR_STATUS_MIN } from './limits.ts';

export const apiErrorSchema = z.object({
  statusCode: z.number().int().min(ERROR_STATUS_MIN).max(ERROR_STATUS_MAX),
  error: z.string(),
  message: z.string(),
});

export type ApiError = z.output<typeof apiErrorSchema>;
