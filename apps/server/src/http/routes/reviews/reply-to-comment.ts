import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commentThreadParamsSchema,
  replyToCommentRequestSchema,
  replyToCommentResponseSchema,
} from '@porcelain/contracts/reviews';
import type { FastifyInstance } from 'fastify';
import type { CommentThreadsController } from '../../../controllers/comment-threads-controller.ts';
import { callerOf } from '../../principal.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function replyToComment(
  server: FastifyInstance,
  options: { controller: Pick<CommentThreadsController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/worktrees/:worktreeId/comments/:threadId/replies',
    {
      schema: {
        params: commentThreadParamsSchema,
        body: replyToCommentRequestSchema,
        response: { ...errorResponses, 200: replyToCommentResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        {
          command: { kind: 'reply', ...request.params, ...request.body },
          principal: callerOf(request),
        },
        { signal: request.disconnected },
      ),
  );
}
