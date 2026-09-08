import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { apiErrorSchema } from '@porcelain/contracts/api-error';
import {
  replaceReviewLayersSchema,
  reviewLayerParamsSchema,
  reviewLayersResponseSchema,
} from '@porcelain/contracts/review-layers';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { errorResponses } from '../schemas/error-responses.ts';
export async function reviewLayerRoutes(
  server: FastifyInstance,
  options: { application: Application; token: string },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options.token));
  const response = {
    ...errorResponses,
    404: apiErrorSchema,
    409: apiErrorSchema,
    200: reviewLayersResponseSchema,
  };
  server.withTypeProvider<ZodTypeProvider>().get(
    '/worktrees/:worktreeId/review-layers',
    {
      schema: { params: reviewLayerParamsSchema, response },
    },
    async (request) =>
      options.application.reviewLayers(request.params.worktreeId),
  );
  server.withTypeProvider<ZodTypeProvider>().put(
    '/worktrees/:worktreeId/review-layers',
    {
      bodyLimit: 1024 * 1024,
      schema: {
        params: reviewLayerParamsSchema,
        body: replaceReviewLayersSchema,
        response,
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
