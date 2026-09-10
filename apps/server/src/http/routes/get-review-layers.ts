import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  reviewLayerParamsSchema,
  reviewLayersResponseSchema,
} from '@porcelain/contracts/review-layers';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function getReviewLayers(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/review-layers',
    {
      schema: {
        params: reviewLayerParamsSchema,
        response: { ...errorResponses, 200: reviewLayersResponseSchema },
      },
    },
    async (request) =>
      options.application.reviewLayers(request.params.worktreeId),
  );
}
