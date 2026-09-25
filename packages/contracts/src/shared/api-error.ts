import { z } from 'zod';
import { ERROR_STATUS_MAX, ERROR_STATUS_MIN } from './limits.ts';

const apiErrorCodeSchema = z.enum([
  'content_changed',
  'file_too_large',
  'unsupported_text',
  'worktree_changed',
]);

export const apiErrorSchema = z.object({
  statusCode: z.number().int().min(ERROR_STATUS_MIN).max(ERROR_STATUS_MAX),
  error: z.string(),
  message: z.string(),
  code: apiErrorCodeSchema.optional(),
});

export type ApiErrorCode = z.output<typeof apiErrorCodeSchema>;
export type ApiError = z.output<typeof apiErrorSchema>;
