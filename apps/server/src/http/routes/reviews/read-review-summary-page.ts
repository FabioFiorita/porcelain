import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  readReviewSummaryNotFoundResponseSchema,
  readReviewSummaryParamsSchema,
  readReviewSummaryQuerySchema,
  readReviewSummaryResponseSchema,
} from '@porcelain/contracts/reviews';
import type { FastifyInstance } from 'fastify';
import type { ReadReviewSummaryUseCase } from '../../../use-cases/reviews/read-review-summary.ts';
import { summaryPage } from '../../presenters/summary-page.ts';

export function readReviewSummaryPage(
  server: FastifyInstance,
  options: { useCase: Pick<ReadReviewSummaryUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/review-summaries/:token',
    {
      schema: {
        params: readReviewSummaryParamsSchema,
        querystring: readReviewSummaryQuerySchema,
        response: {
          200: readReviewSummaryResponseSchema,
          404: readReviewSummaryNotFoundResponseSchema,
        },
      },
    },
    async (request, reply) =>
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
  );
}
