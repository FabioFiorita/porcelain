import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { gitWorktreeParamsSchema } from '@porcelain/contracts/git-status';
import {
  reviewedLayerMarksResponseSchema,
  reviewedLayerQuerySchema,
  setReviewedLayerRequestSchema,
} from '@porcelain/contracts/reviewed-files';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { authenticate } from '../middlewares/authenticate.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export async function reviewedLayerRoutes(
  server: FastifyInstance,
  options: { application: Application },
) {
  server.addHook('onRequest', preventCaching);
  server.addHook('onRequest', authenticate(options));
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/reviewed-layers',
    {
      schema: {
        params: gitWorktreeParamsSchema,
        response: { ...errorResponses, 200: reviewedLayerMarksResponseSchema },
      },
    },
    async (request) =>
      options.application.listReviewedLayers(
        request.params.worktreeId,
        request.disconnected,
      ),
  );
  api.put(
    '/worktrees/:worktreeId/reviewed-layers',
    {
      schema: {
        params: gitWorktreeParamsSchema,
        body: setReviewedLayerRequestSchema,
        response: { ...errorResponses, 200: reviewedLayerMarksResponseSchema },
      },
    },
    async (request) =>
      options.application.setReviewedLayer(
        request.params.worktreeId,
        request.body,
        request.disconnected,
      ),
  );
  api.delete(
    '/worktrees/:worktreeId/reviewed-layers',
    {
      schema: {
        params: gitWorktreeParamsSchema,
        querystring: reviewedLayerQuerySchema,
        response: { ...errorResponses, 200: reviewedLayerMarksResponseSchema },
      },
    },
    async (request) =>
      options.application.removeReviewedLayer(
        request.params.worktreeId,
        request.query.layerId,
        request.disconnected,
      ),
  );
}
