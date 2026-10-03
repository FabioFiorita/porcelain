import { readReviewSummaryPageEndpoint } from '@porcelain/contracts/reviews';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadReviewSummaryUseCase } from '../../../use-cases/reviews/read-review-summary.ts';
import { summaryPage } from '../../presenters/summary-page.ts';

export function readReviewSummaryPage(
  server: FastifyInstance,
  options: { useCase: Pick<ReadReviewSummaryUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readReviewSummaryPageEndpoint.method,
    url: readReviewSummaryPageEndpoint.path,
    schema: readReviewSummaryPageEndpoint.schema,
    handler: async (request, reply) =>
      reply
        .type('text/html; charset=utf-8')
        .send(
          summaryPage(
            await options.useCase.execute(
              { ...request.params, ...request.query },
              { signal: request.disconnected },
            ),
          ),
        ),
  });
}
