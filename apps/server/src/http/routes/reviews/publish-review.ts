import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  publishReviewRequestSchema,
  publishReviewResponseSchema,
} from '@porcelain/contracts/reviews';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { PublishReviewController } from '../../../controllers/publish-review-controller.ts';
import { publishReviewBodyLimit } from '../../../config/request-limits.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function publishReview(
  server: FastifyInstance,
  options: { controller: Pick<PublishReviewController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.put(
    '/worktrees/:worktreeId/review',
    {
      bodyLimit: publishReviewBodyLimit,
      schema: {
        params: worktreeParamsSchema,
        body: publishReviewRequestSchema,
        response: { ...errorResponses, 200: publishReviewResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, review: request.body },
        { signal: request.disconnected },
      ),
  );
}
