import { readPublishedReviewEndpoint } from '@porcelain/contracts/reviews';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadPublishedReviewUseCase } from '../../../use-cases/reviews/read-published-review.ts';

export function readPublishedReview(
  server: FastifyInstance,
  options: { useCase: Pick<ReadPublishedReviewUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readPublishedReviewEndpoint.method,
    url: readPublishedReviewEndpoint.path,
    schema: readPublishedReviewEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  });
}
