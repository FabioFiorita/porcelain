import { z } from 'zod';

export const apiErrorSchema = z.object({
  code: z.enum([
    'UNAUTHORIZED',
    'INVALID_REQUEST',
    'WORKTREE_NOT_FOUND',
    'REPOSITORY_UNAVAILABLE',
    'SERVICE_UNAVAILABLE',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
});
