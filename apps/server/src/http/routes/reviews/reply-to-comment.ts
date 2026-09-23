import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commentThreadParamsSchema,
  replyToCommentRequestSchema,
  replyToCommentResponseSchema,
} from '@porcelain/contracts/reviews';
import type { FastifyInstance } from 'fastify';
import type { ReplyToCommentController } from '../../../controllers/reply-to-comment-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function replyToComment(
  server: FastifyInstance,
  options: { controller: Pick<ReplyToCommentController, 'execute'> },
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
        { ...request.params, ...request.body, writer: request.principal },
        { signal: request.disconnected },
      ),
  );
}
