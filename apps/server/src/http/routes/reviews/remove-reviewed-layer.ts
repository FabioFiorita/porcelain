import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  removeReviewedLayerQuerySchema,
  removeReviewedLayerResponseSchema,
} from '@porcelain/contracts/reviews';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { RemoveReviewedLayerUseCase } from '../../../use-cases/reviews/remove-reviewed-layer.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function removeReviewedLayer(
  server: FastifyInstance,
  options: { useCase: Pick<RemoveReviewedLayerUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.delete(
    '/worktrees/:worktreeId/reviewed-layers',
    {
      schema: {
        params: worktreeParamsSchema,
        querystring: removeReviewedLayerQuerySchema,
        response: { ...errorResponses, 200: removeReviewedLayerResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  );
}
