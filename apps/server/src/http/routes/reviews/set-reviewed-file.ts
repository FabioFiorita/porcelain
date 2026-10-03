import { setReviewedFileEndpoint } from '@porcelain/contracts/reviews';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { SetReviewedFilesUseCase } from '../../../use-cases/reviews/set-reviewed-files.ts';

export function setReviewedFile(
  server: FastifyInstance,
  options: { useCase: Pick<SetReviewedFilesUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: setReviewedFileEndpoint.method,
    url: setReviewedFileEndpoint.path,
    schema: setReviewedFileEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body, onConflict: 'refuse' },
        { signal: request.disconnected },
      ),
  });
}
