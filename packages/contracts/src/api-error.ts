import { z } from 'zod';

export const apiErrorSchema = z.object({
  code: z.enum([
    'UNAUTHORIZED',
    'INVALID_REQUEST',
    'WORKTREE_NOT_FOUND',
    'PATH_NOT_FOUND',
    'PATH_NOT_READABLE',
    'UNSUPPORTED_TEXT',
    'FILE_TOO_LARGE',
    'DIRECTORY_TOO_LARGE',
    'CONTENT_CHANGED',
    'REPOSITORY_UNAVAILABLE',
    'SERVICE_UNAVAILABLE',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
});
