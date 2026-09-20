import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { gitWorktreeParamsSchema } from '@porcelain/contracts/git-status';
import {
  reviewedMarksResponseSchema,
  reviewSummarySchema,
} from '@porcelain/contracts/reviewed-files';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function listReviewedFiles(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/review-summary',
    {
      schema: {
        params: gitWorktreeParamsSchema,
        response: { ...errorResponses, 200: reviewSummarySchema },
      },
    },
    async (request) =>
      options.application.reviewSummary(
        request.params.worktreeId,
        request.disconnected,
      ),
  );
  api.get(
    '/worktrees/:worktreeId/reviewed',
    {
      schema: {
        params: gitWorktreeParamsSchema,
        response: { ...errorResponses, 200: reviewedMarksResponseSchema },
      },
    },
    async (request) =>
      options.application.listReviewedFiles(
        request.params.worktreeId,
        request.disconnected,
      ),
  );
}
