import { listReviewedLayersEndpoint } from '@porcelain/contracts/reviews';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ListReviewedLayersUseCase } from '../../../use-cases/reviews/list-reviewed-layers.ts';

export function listReviewedLayers(
  server: FastifyInstance,
  options: { useCase: Pick<ListReviewedLayersUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: listReviewedLayersEndpoint.method,
    url: listReviewedLayersEndpoint.path,
    schema: listReviewedLayersEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  });
}
