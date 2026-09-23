import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { listReviewedLayersResponseSchema } from '@porcelain/contracts/reviews';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { ListReviewedLayersController } from '../../../controllers/list-reviewed-layers-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function listReviewedLayers(
  server: FastifyInstance,
  options: { controller: Pick<ListReviewedLayersController, 'execute'> },
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
      options.controller.execute(request.params, {
        signal: request.disconnected,
      }),
  );
}
