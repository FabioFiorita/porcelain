import { setReviewedFilesEndpoint } from '@porcelain/contracts/reviews';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { SetReviewedFilesUseCase } from '../../../use-cases/reviews/set-reviewed-files.ts';

export function setReviewedFiles(
  server: FastifyInstance,
  options: { useCase: Pick<SetReviewedFilesUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: setReviewedFilesEndpoint.method,
    url: setReviewedFilesEndpoint.path,
    schema: setReviewedFilesEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body, onConflict: 'report' },
        { signal: request.disconnected },
      ),
  });
}
