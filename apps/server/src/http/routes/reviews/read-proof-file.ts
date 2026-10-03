import { readProofFileEndpoint } from '@porcelain/contracts/reviews';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadProofFileUseCase } from '../../../use-cases/reviews/read-proof-file.ts';

export function readProofFile(
  server: FastifyInstance,
  options: { useCase: Pick<ReadProofFileUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readProofFileEndpoint.method,
    url: readProofFileEndpoint.path,
    schema: readProofFileEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  });
}
