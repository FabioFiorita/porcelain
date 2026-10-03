import { removeReviewedFilesEndpoint } from '@porcelain/contracts/reviews';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { RemoveReviewedFilesUseCase } from '../../../use-cases/reviews/remove-reviewed-files.ts';

export function removeReviewedFiles(
  server: FastifyInstance,
  options: { useCase: Pick<RemoveReviewedFilesUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: removeReviewedFilesEndpoint.method,
    url: removeReviewedFilesEndpoint.path,
    schema: removeReviewedFilesEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  });
}
