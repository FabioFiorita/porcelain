import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { gitWorktreeParamsSchema } from '@porcelain/contracts/changes';
import { reviewedMarksResponseSchema } from '@porcelain/contracts/reviews';
import type { FastifyInstance } from 'fastify';
import type { ListReviewedFilesController } from '../../../controllers/list-reviewed-files-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function listReviewedFiles(
  server: FastifyInstance,
  options: { controller: Pick<ListReviewedFilesController, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/reviewed',
    {
      schema: {
        params: gitWorktreeParamsSchema,
        response: { ...errorResponses, 200: reviewedMarksResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(request.params, {
        signal: request.disconnected,
      }),
  );
}
