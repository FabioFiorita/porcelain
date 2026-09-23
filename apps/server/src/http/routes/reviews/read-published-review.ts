import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  reviewParamsSchema,
  reviewReadResponseSchema,
} from '@porcelain/contracts/reviews';
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
        params: reviewParamsSchema,
        response: { ...errorResponses, 200: reviewReadResponseSchema },
      },
    },
    async (request) => ({
      review: await options.controller.execute(request.params, {
        signal: request.disconnected,
      }),
    }),
  );
}
