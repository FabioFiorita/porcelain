import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  removeReviewedFilesRequestSchema,
  removeReviewedFilesResponseSchema,
} from '@porcelain/contracts/reviews';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { RemoveReviewedFilesUseCase } from '../../../use-cases/reviews/remove-reviewed-files.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function removeReviewedFiles(
  server: FastifyInstance,
  options: { useCase: Pick<RemoveReviewedFilesUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.delete(
    '/worktrees/:worktreeId/reviewed-bulk',
    {
      schema: {
        params: worktreeParamsSchema,
        body: removeReviewedFilesRequestSchema,
        response: { ...errorResponses, 200: removeReviewedFilesResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  );
}
