import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commentThreadParamsSchema,
  editCommentMessageRequestSchema,
  editCommentMessageResponseSchema,
} from '@porcelain/contracts/reviews';
import type { FastifyInstance } from 'fastify';
import type { EditCommentMessageUseCase } from '../../../use-cases/reviews/edit-comment-message.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function editCommentMessage(
  server: FastifyInstance,
  options: { useCase: Pick<EditCommentMessageUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.patch(
    '/worktrees/:worktreeId/comments/:threadId/messages',
    {
      schema: {
        params: commentThreadParamsSchema,
        body: editCommentMessageRequestSchema,
        response: { ...errorResponses, 200: editCommentMessageResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body, writer: request.caller },
        { signal: request.disconnected },
      ),
  );
}
