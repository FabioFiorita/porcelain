import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commentScopeSchema,
  commentThreadsSchema,
  createCommentThreadSchema,
} from '@porcelain/contracts/reviews';
import type { FastifyInstance } from 'fastify';
import type { CommentThreadsController } from '../../../controllers/comment-threads-controller.ts';
import { callerOf } from '../../principal.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function createCommentThread(
  server: FastifyInstance,
  options: { controller: Pick<CommentThreadsController, 'execute'> },
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
      options.controller.execute(
        {
          command: { kind: 'create', ...request.params, ...request.body },
          principal: callerOf(request),
        },
        { signal: request.disconnected },
      ),
  );
}
