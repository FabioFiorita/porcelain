import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { gitWorktreeParamsSchema } from '@porcelain/contracts/changes';
import {
  reviewedMarksResponseSchema,
  reviewedPathQuerySchema,
} from '@porcelain/contracts/reviews';
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
        params: gitWorktreeParamsSchema,
        querystring: reviewedPathQuerySchema,
        response: { ...errorResponses, 200: reviewedMarksResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  );
}
