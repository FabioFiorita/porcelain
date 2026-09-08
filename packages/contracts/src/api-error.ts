import { z } from 'zod';

export const apiErrorSchema = z.object({
  code: z.enum([
    'WORKTREE_NOT_FOUND',
    'WORKTREE_CHANGED',
    'INSPECTION_LIMIT',
    'UNSUPPORTED_PATH_ENCODING',
    'UNAUTHORIZED',
    'INVALID_REQUEST',
    'REPOSITORY_UNAVAILABLE',
    'SERVICE_UNAVAILABLE',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
});
