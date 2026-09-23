import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { gitWorktreeParamsSchema } from '@porcelain/contracts/changes';
import { reviewedLayerMarksResponseSchema } from '@porcelain/contracts/reviews';
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
        params: gitWorktreeParamsSchema,
        response: { ...errorResponses, 200: reviewedLayerMarksResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(request.params, {
        signal: request.disconnected,
      }),
  );
}
