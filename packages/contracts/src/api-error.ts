import { z } from 'zod';

export const apiErrorSchema = z.object({
  code: z.enum([
    'UNAUTHORIZED',
    'WORKTREE_NOT_FOUND',
    'INVALID_REQUEST',
    'REPOSITORY_UNAVAILABLE',
    'SERVICE_UNAVAILABLE',
    'INTERNAL_ERROR',
    'HISTORY_SNAPSHOT_UNAVAILABLE',
    'READ_LIMIT_EXCEEDED',
    'UNSUPPORTED_HISTORY_DATA',
  ]),
  message: z.string(),
});
