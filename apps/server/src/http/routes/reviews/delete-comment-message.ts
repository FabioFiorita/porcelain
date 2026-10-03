import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commentThreadParamsSchema,
  deleteCommentMessageQuerySchema,
  deleteCommentMessageResponseSchema,
} from '@porcelain/contracts/reviews';
import type { FastifyInstance } from 'fastify';
import type { DeleteCommentMessageUseCase } from '../../../use-cases/reviews/delete-comment-message.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function deleteCommentMessage(
  server: FastifyInstance,
  options: { useCase: Pick<DeleteCommentMessageUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.delete(
    '/worktrees/:worktreeId/comments/:threadId/messages',
    {
      schema: {
        params: commentThreadParamsSchema,
        querystring: deleteCommentMessageQuerySchema,
        response: {
          ...errorResponses,
          200: deleteCommentMessageResponseSchema,
        },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query, writer: request.caller },
        { signal: request.disconnected },
      ),
  );
}
