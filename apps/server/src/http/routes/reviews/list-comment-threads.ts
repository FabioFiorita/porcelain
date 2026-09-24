import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { listCommentThreadsResponseSchema } from '@porcelain/contracts/reviews';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { ListCommentThreadsUseCase } from '../../../use-cases/reviews/list-comment-threads.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function listCommentThreads(
  server: FastifyInstance,
  options: { useCase: Pick<ListCommentThreadsUseCase, 'execute'> },
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
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  );
}
