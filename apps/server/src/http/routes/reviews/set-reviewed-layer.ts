import { setReviewedLayerEndpoint } from '@porcelain/contracts/reviews';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { SetReviewedLayerUseCase } from '../../../use-cases/reviews/set-reviewed-layer.ts';

export function setReviewedLayer(
  server: FastifyInstance,
  options: { useCase: Pick<SetReviewedLayerUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: setReviewedLayerEndpoint.method,
    url: setReviewedLayerEndpoint.path,
    schema: setReviewedLayerEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  });
}
