import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  publishReviewSchema,
  reviewParamsSchema,
  reviewReadResponseSchema,
} from '@porcelain/contracts/review';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export async function publishedReviewRoutes(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options));
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
      review: await options.application.review(
        request.params.worktreeId,
        request.disconnected,
      ),
    }),
  );
  api.put(
    '/worktrees/:worktreeId/review',
    {
      bodyLimit: 10 * 1024 * 1024 * 6 + 1024 * 1024,
      schema: {
        params: reviewParamsSchema,
        body: publishReviewSchema,
        response: { ...errorResponses, 200: reviewReadResponseSchema },
      },
    },
    async (request) => ({
      review: await options.application.publishReview(
        request.params.worktreeId,
        request.body,
        request.disconnected,
      ),
    }),
  );
}
