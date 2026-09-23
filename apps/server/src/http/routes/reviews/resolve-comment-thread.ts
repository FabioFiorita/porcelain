import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commentThreadParamsSchema,
  resolveCommentThreadRequestSchema,
  resolveCommentThreadResponseSchema,
} from '@porcelain/contracts/reviews';
import type { FastifyInstance } from 'fastify';
import type { ResolveCommentThreadController } from '../../../controllers/resolve-comment-thread-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function resolveCommentThread(
  server: FastifyInstance,
  options: { controller: Pick<ResolveCommentThreadController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.put(
    '/worktrees/:worktreeId/comments/:threadId/resolution',
    {
      schema: {
        params: commentThreadParamsSchema,
        body: resolveCommentThreadRequestSchema,
        response: {
          ...errorResponses,
          200: resolveCommentThreadResponseSchema,
        },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
