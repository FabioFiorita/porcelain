import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  replaceReviewLayersSchema,
  reviewLayerParamsSchema,
  reviewLayersResponseSchema,
} from '@porcelain/contracts/review-layers';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function replaceReviewLayers(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.put(
    '/worktrees/:worktreeId/review-layers',
    {
      bodyLimit: 1024 * 1024,
      schema: {
        tags: ['Review layers'],
        summary: 'Replace layers using the current revision',
        params: reviewLayerParamsSchema,
        body: replaceReviewLayersSchema,
        response: { ...errorResponses, 200: reviewLayersResponseSchema },
      },
    },
    async (request) =>
      options.application.replaceReviewLayers(
        request.params.worktreeId,
        request.body.expectedRevision,
        request.body.layers,
      ),
  );
}
