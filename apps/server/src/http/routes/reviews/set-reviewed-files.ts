import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  setReviewedFilesRequestSchema,
  setReviewedFilesResponseSchema,
} from '@porcelain/contracts/reviews';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { SetReviewedFilesUseCase } from '../../../use-cases/reviews/set-reviewed-files.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function setReviewedFiles(
  server: FastifyInstance,
  options: { useCase: Pick<SetReviewedFilesUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.put(
    '/worktrees/:worktreeId/reviewed-bulk',
    {
      schema: {
        params: worktreeParamsSchema,
        body: setReviewedFilesRequestSchema,
        response: { ...errorResponses, 200: setReviewedFilesResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body, onConflict: 'report' },
        { signal: request.disconnected },
      ),
  );
}
