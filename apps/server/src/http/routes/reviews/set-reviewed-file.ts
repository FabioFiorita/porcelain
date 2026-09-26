import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  setReviewedFileRequestSchema,
  setReviewedFileResponseSchema,
} from '@porcelain/contracts/reviews';
import { worktreeParamsSchema } from '@porcelain/contracts/shared';
import type { FastifyInstance } from 'fastify';
import type { SetReviewedFilesUseCase } from '../../../use-cases/reviews/set-reviewed-files.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function setReviewedFile(
  server: FastifyInstance,
  options: { useCase: Pick<SetReviewedFilesUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.put(
    '/worktrees/:worktreeId/reviewed',
    {
      schema: {
        params: worktreeParamsSchema,
        body: setReviewedFileRequestSchema,
        response: { ...errorResponses, 200: setReviewedFileResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body, onConflict: 'refuse' },
        { signal: request.disconnected },
      ),
  );
}
