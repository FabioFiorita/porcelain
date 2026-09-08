import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commentScopeSchema,
  commentThreadsSchema,
} from '@porcelain/contracts/comments';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function listCommentThreads(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/comments',
    {
      schema: {
        tags: ['Comments'],
        summary: 'List discussions for a worktree',
        params: commentScopeSchema,
        response: { ...errorResponses, 200: commentThreadsSchema },
      },
    },
    async (request) =>
      options.application.comments({ kind: 'list', ...request.params }),
  );
}
