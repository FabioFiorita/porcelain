import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { gitWorktreeParamsSchema } from '@porcelain/contracts/changes';
import {
  reviewedLayerMarksResponseSchema,
  reviewedLayerQuerySchema,
} from '@porcelain/contracts/reviews';
import type { FastifyInstance } from 'fastify';
import type { RemoveReviewedLayerController } from '../../../controllers/remove-reviewed-layer-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function removeReviewedLayer(
  server: FastifyInstance,
  options: { controller: Pick<RemoveReviewedLayerController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.delete(
    '/worktrees/:worktreeId/reviewed-layers',
    {
      schema: {
        params: gitWorktreeParamsSchema,
        querystring: reviewedLayerQuerySchema,
        response: { ...errorResponses, 200: reviewedLayerMarksResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  );
}
