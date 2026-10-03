import { publishReviewEndpoint } from '@porcelain/contracts/reviews';
import type { Limits } from '../../../config/limits.ts';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { PublishReviewUseCase } from '../../../use-cases/reviews/publish-review.ts';

export function publishReview(
  server: FastifyInstance,
  options: {
    useCase: Pick<PublishReviewUseCase, 'execute'>;
    limits: Limits['http'];
  },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: publishReviewEndpoint.method,
    url: publishReviewEndpoint.path,
    schema: publishReviewEndpoint.schema,
    bodyLimit: options.limits.reviewBodyBytes,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  });
}
