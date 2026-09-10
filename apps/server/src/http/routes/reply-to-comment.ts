import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commentThreadScopeSchema,
  commentThreadsSchema,
  replyToCommentSchema,
} from '@porcelain/contracts/comments';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function replyToComment(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/worktrees/:worktreeId/comments/:threadId/replies',
    {
      schema: {
        params: commentThreadScopeSchema,
        body: replyToCommentSchema,
        response: { ...errorResponses, 200: commentThreadsSchema },
      },
    },
    async (request) =>
      options.application.comments({
        kind: 'reply',
        ...request.params,
        ...request.body,
      }),
  );
}
