import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { gitWorktreeParamsSchema } from '@porcelain/contracts/git-status';
import {
  reviewedMarksResponseSchema,
  setReviewedRequestSchema,
} from '@porcelain/contracts/reviewed-files';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { errorResponses } from '../schemas/error-responses.ts';

export function setReviewedFile(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.put(
    '/worktrees/:worktreeId/reviewed',
    {
      schema: {
        params: gitWorktreeParamsSchema,
        body: setReviewedRequestSchema,
        response: { ...errorResponses, 200: reviewedMarksResponseSchema },
      },
    },
    async (request) =>
      options.application.setReviewedFile(
        request.params.worktreeId,
        request.body,
      ),
  );
}
