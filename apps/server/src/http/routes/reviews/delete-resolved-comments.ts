import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  deleteResolvedCommentsRequestSchema,
  deleteResolvedCommentsResponseSchema,
} from '@porcelain/contracts/reviews';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { DeleteResolvedCommentsUseCase } from '../../../use-cases/reviews/delete-resolved-comments.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function deleteResolvedComments(
  server: FastifyInstance,
  options: { useCase: Pick<DeleteResolvedCommentsUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/worktrees/:worktreeId/comments/resolved/deletion',
    {
      schema: {
        params: worktreeParamsSchema,
        body: deleteResolvedCommentsRequestSchema,
        response: {
          ...errorResponses,
          200: deleteResolvedCommentsResponseSchema,
        },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body, writer: request.caller },
        { signal: request.disconnected },
      ),
  );
}
