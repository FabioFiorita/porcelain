import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { readPublishedReviewResponseSchema } from '@porcelain/contracts/reviews';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { ReadPublishedReviewController } from '../../../controllers/read-published-review-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function readPublishedReview(
  server: FastifyInstance,
  options: { controller: Pick<ReadPublishedReviewController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/review',
    {
      schema: {
        params: worktreeParamsSchema,
        response: { ...errorResponses, 200: readPublishedReviewResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(request.params, {
        signal: request.disconnected,
      }),
  );
}
