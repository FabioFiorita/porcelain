import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commentThreadScopeSchema,
  commentThreadsSchema,
  resolveCommentSchema,
} from '@porcelain/contracts/comments';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function resolveCommentThread(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.put(
    '/worktrees/:worktreeId/comments/:threadId/resolution',
    {
      schema: {
        params: commentThreadScopeSchema,
        body: resolveCommentSchema,
        response: { ...errorResponses, 200: commentThreadsSchema },
      },
    },
    async (request) =>
      options.application.comments({
        kind: 'resolve',
        ...request.params,
        ...request.body,
      }),
  );
}
