import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commentThreadParamsSchema,
  updateCommentThreadRequestSchema,
  updateCommentThreadResponseSchema,
} from '@porcelain/contracts/reviews';
import type { FastifyInstance } from 'fastify';
import type { UpdateCommentThreadUseCase } from '../../../use-cases/reviews/update-comment-thread.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function updateCommentThread(
  server: FastifyInstance,
  options: { useCase: Pick<UpdateCommentThreadUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.put(
    '/worktrees/:worktreeId/comments/:threadId/resolution',
    {
      schema: {
        params: commentThreadParamsSchema,
        body: updateCommentThreadRequestSchema,
        response: {
          ...errorResponses,
          200: updateCommentThreadResponseSchema,
        },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
