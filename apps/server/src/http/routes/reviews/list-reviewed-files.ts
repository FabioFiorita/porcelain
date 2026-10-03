import { listReviewedFilesEndpoint } from '@porcelain/contracts/reviews';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ListReviewedFilesUseCase } from '../../../use-cases/reviews/list-reviewed-files.ts';

export function listReviewedFiles(
  server: FastifyInstance,
  options: { useCase: Pick<ListReviewedFilesUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: listReviewedFilesEndpoint.method,
    url: listReviewedFilesEndpoint.path,
    schema: listReviewedFilesEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  });
}
