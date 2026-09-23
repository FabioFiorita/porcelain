import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  removeReviewedFileQuerySchema,
  removeReviewedFileResponseSchema,
} from '@porcelain/contracts/reviews';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { RemoveReviewedFileController } from '../../../controllers/remove-reviewed-file-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function removeReviewedFile(
  server: FastifyInstance,
  options: { controller: Pick<RemoveReviewedFileController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.delete(
    '/worktrees/:worktreeId/reviewed',
    {
      schema: {
        params: worktreeParamsSchema,
        querystring: removeReviewedFileQuerySchema,
        response: { ...errorResponses, 200: removeReviewedFileResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  );
}
