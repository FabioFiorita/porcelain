import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commentThreadParamsSchema,
  resolveCommentThreadRequestSchema,
  resolveCommentThreadResponseSchema,
} from '@porcelain/contracts/reviews';
import type { FastifyInstance } from 'fastify';
import type { CommentThreadsController } from '../../../controllers/comment-threads-controller.ts';
import { callerOf } from '../../principal.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function resolveCommentThread(
  server: FastifyInstance,
  options: { controller: Pick<CommentThreadsController, 'execute'> },
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
        {
          command: { kind: 'resolve', ...request.params, ...request.body },
          principal: callerOf(request),
        },
        { signal: request.disconnected },
      ),
  );
}
