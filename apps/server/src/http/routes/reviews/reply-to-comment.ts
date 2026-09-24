import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commentThreadParamsSchema,
  replyToCommentRequestSchema,
  replyToCommentResponseSchema,
} from '@porcelain/contracts/reviews';
import type { FastifyInstance } from 'fastify';
import type { ReplyToCommentUseCase } from '../../../use-cases/reviews/reply-to-comment.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function replyToComment(
  server: FastifyInstance,
  options: { useCase: Pick<ReplyToCommentUseCase, 'execute'> },
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
      options.useCase.execute(
        { ...request.params, ...request.body, writer: request.principal },
        { signal: request.disconnected },
      ),
  );
}
