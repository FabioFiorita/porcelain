import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { listReviewedFilesResponseSchema } from '@porcelain/contracts/reviews';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { ListReviewedFilesUseCase } from '../../../use-cases/reviews/list-reviewed-files.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function listReviewedFiles(
  server: FastifyInstance,
  options: { useCase: Pick<ListReviewedFilesUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/reviewed',
    {
      schema: {
        params: worktreeParamsSchema,
        response: { ...errorResponses, 200: listReviewedFilesResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  );
}
