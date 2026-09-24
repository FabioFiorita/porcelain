import type { Limits } from '../../../config/limits.ts';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  publishReviewRequestSchema,
  publishReviewResponseSchema,
} from '@porcelain/contracts/reviews';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { PublishReviewUseCase } from '../../../use-cases/reviews/publish-review.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function publishReview(
  server: FastifyInstance,
  options: {
    useCase: Pick<PublishReviewUseCase, 'execute'>;
    limits: Limits['http'];
  },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.put(
    '/worktrees/:worktreeId/review',
    {
      bodyLimit: options.limits.reviewBodyBytes,
      schema: {
        params: worktreeParamsSchema,
        body: publishReviewRequestSchema,
        response: { ...errorResponses, 200: publishReviewResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
