import { z } from 'zod';

export const apiErrorSchema = z.object({
  code: z.enum([
    'UNAUTHORIZED',
    'UNKNOWN_WORKTREE',
    'REVISION_CONFLICT',
    'INVALID_REQUEST',
    'REPOSITORY_UNAVAILABLE',
    'SERVICE_UNAVAILABLE',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
});
