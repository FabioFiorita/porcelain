import { removeReviewedLayerEndpoint } from '@porcelain/contracts/reviews';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { RemoveReviewedLayerUseCase } from '../../../use-cases/reviews/remove-reviewed-layer.ts';

export function removeReviewedLayer(
  server: FastifyInstance,
  options: { useCase: Pick<RemoveReviewedLayerUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: removeReviewedLayerEndpoint.method,
    url: removeReviewedLayerEndpoint.path,
    schema: removeReviewedLayerEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  });
}
