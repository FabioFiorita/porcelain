import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  publishReviewRequestSchema,
  publishReviewResponseSchema,
} from '@porcelain/contracts/reviews';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { PublishReviewUseCase } from '../../../use-cases/reviews/publish-review.ts';
import { publishReviewBodyLimit } from '../../../config/request-limits.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function publishReview(
  server: FastifyInstance,
  options: { useCase: Pick<PublishReviewUseCase, 'execute'> },
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
      options.useCase.execute(
        { ...request.params, review: request.body },
        { signal: request.disconnected },
      ),
  );
}
