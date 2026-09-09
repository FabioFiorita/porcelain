import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  associateCommitReviewLayersSchema,
  commitReviewLayerParamsSchema,
  commitReviewLayersResponseSchema,
} from '@porcelain/contracts/commit-review-layers';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function associateCommitReviewLayers(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.withTypeProvider<ZodTypeProvider>().put(
    '/projects/:projectId/commits/:oid/review-layers',
    {
      bodyLimit: 1024 * 1024,
      schema: {
        tags: ['Review layers'],
        summary: 'Confirm an immutable layer association for a commit',
        params: commitReviewLayerParamsSchema,
        body: associateCommitReviewLayersSchema,
        response: { ...errorResponses, 200: commitReviewLayersResponseSchema },
      },
    },
    async (request) =>
      options.application.associateCommitReviewLayers(
        request.params.projectId,
        request.params.oid,
        request.body,
      ),
  );
}
