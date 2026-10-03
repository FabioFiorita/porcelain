import { removeReviewedFileEndpoint } from '@porcelain/contracts/reviews';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { RemoveReviewedFilesUseCase } from '../../../use-cases/reviews/remove-reviewed-files.ts';

export function removeReviewedFile(
  server: FastifyInstance,
  options: { useCase: Pick<RemoveReviewedFilesUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: removeReviewedFileEndpoint.method,
    url: removeReviewedFileEndpoint.path,
    schema: removeReviewedFileEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  });
}
