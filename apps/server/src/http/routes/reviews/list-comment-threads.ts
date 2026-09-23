import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { listCommentThreadsResponseSchema } from '@porcelain/contracts/reviews';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { CommentThreadsController } from '../../../controllers/comment-threads-controller.ts';
import { callerOf } from '../../principal.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function listCommentThreads(
  server: FastifyInstance,
  options: { controller: Pick<CommentThreadsController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/comments',
    {
      schema: {
        params: worktreeParamsSchema,
        response: { ...errorResponses, 200: listCommentThreadsResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        {
          command: { kind: 'list', ...request.params },
          principal: callerOf(request),
        },
        { signal: request.disconnected },
      ),
  );
}
