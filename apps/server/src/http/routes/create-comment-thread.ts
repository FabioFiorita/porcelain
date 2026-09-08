import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commentScopeSchema,
  commentThreadsSchema,
  createCommentThreadSchema,
} from '@porcelain/contracts/comments';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function createCommentThread(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/worktrees/:worktreeId/comments',
    {
      schema: {
        params: commentScopeSchema,
        body: createCommentThreadSchema,
        response: { ...errorResponses, 200: commentThreadsSchema },
      },
    },
    async (request) =>
      options.application.comments({
        kind: 'create',
        ...request.params,
        ...request.body,
      }),
  );
}
