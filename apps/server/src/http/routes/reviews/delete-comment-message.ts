import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commentMessageParamsSchema,
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
    '/worktrees/:worktreeId/comments/:threadId/messages/:messageId',
    {
      schema: {
        params: commentMessageParamsSchema,
        response: {
          ...errorResponses,
          200: deleteCommentMessageResponseSchema,
        },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, writer: request.caller },
        { signal: request.disconnected },
      ),
  );
}
