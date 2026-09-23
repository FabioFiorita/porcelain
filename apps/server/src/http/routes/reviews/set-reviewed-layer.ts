import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  setReviewedLayerRequestSchema,
  setReviewedLayerResponseSchema,
} from '@porcelain/contracts/reviews';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { SetReviewedLayerController } from '../../../controllers/set-reviewed-layer-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function setReviewedLayer(
  server: FastifyInstance,
  options: { controller: Pick<SetReviewedLayerController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.put(
    '/worktrees/:worktreeId/reviewed-layers',
    {
      schema: {
        params: worktreeParamsSchema,
        body: setReviewedLayerRequestSchema,
        response: { ...errorResponses, 200: setReviewedLayerResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
