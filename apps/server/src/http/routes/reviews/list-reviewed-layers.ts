import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { listReviewedLayersResponseSchema } from '@porcelain/contracts/reviews';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { ListReviewedLayersUseCase } from '../../../use-cases/reviews/list-reviewed-layers.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function listReviewedLayers(
  server: FastifyInstance,
  options: { useCase: Pick<ListReviewedLayersUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/reviewed-layers',
    {
      schema: {
        params: worktreeParamsSchema,
        response: { ...errorResponses, 200: listReviewedLayersResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  );
}
