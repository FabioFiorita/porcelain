import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { gitWorktreeParamsSchema } from '@porcelain/contracts/git-status';
import {
  setReviewedBulkRequestSchema,
  setReviewedBulkResponseSchema,
} from '@porcelain/contracts/reviewed-files';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function setReviewedFiles(
  server: FastifyInstance,
  options: { application: Application },
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
      options.application.setReviewedFiles(
        request.params.worktreeId,
        request.body,
        request.disconnected,
      ),
  );
}
