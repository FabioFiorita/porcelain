import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { gitWorktreeParamsSchema } from '@porcelain/contracts/changes';
import {
  setReviewedBulkRequestSchema,
  setReviewedBulkResponseSchema,
} from '@porcelain/contracts/reviews';
import type { FastifyInstance } from 'fastify';
import type { SetReviewedFilesController } from '../../../controllers/set-reviewed-files-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function setReviewedFiles(
  server: FastifyInstance,
  options: { controller: Pick<SetReviewedFilesController<unknown>, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.put(
    '/worktrees/:worktreeId/reviewed-bulk',
    {
      schema: {
        params: gitWorktreeParamsSchema,
        body: setReviewedBulkRequestSchema,
        response: { ...errorResponses, 200: setReviewedBulkResponseSchema },
      },
    },
    async (request) =>
      options.controller.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
