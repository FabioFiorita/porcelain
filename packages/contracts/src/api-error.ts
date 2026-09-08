import { z } from 'zod';

export const apiErrorSchema = z.object({
  code: z.enum([
    'NOT_FOUND',
    'UNAUTHORIZED',
    'INVALID_REQUEST',
    'REPOSITORY_UNAVAILABLE',
    'SERVICE_UNAVAILABLE',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
});
