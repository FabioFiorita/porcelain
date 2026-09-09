import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  commitReviewLayerParamsSchema,
  commitReviewLayersResponseSchema,
} from '@porcelain/contracts/commit-review-layers';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function getCommitReviewLayers(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.withTypeProvider<ZodTypeProvider>().get(
    '/projects/:projectId/commits/:oid/review-layers',
    {
      schema: {
        tags: ['Review layers'],
        summary: 'Read immutable commit review order',
        params: commitReviewLayerParamsSchema,
        response: {
          ...errorResponses,
          200: commitReviewLayersResponseSchema.nullable(),
        },
      },
    },
    async (request) =>
      options.application.commitReviewLayers(
        request.params.projectId,
        request.params.oid,
      ),
  );
}
