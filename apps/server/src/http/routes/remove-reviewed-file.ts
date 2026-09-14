import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { gitWorktreeParamsSchema } from '@porcelain/contracts/git-status';
import {
  reviewedMarksResponseSchema,
  reviewedPathQuerySchema,
} from '@porcelain/contracts/reviewed-files';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function removeReviewedFile(
  server: FastifyInstance,
  options: { application: Application },
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
      options.application.removeReviewedFile(
        request.params.worktreeId,
        request.query.path,
      ),
  );
}
