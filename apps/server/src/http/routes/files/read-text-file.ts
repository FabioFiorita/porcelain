import { readTextFileEndpoint } from '@porcelain/contracts/files';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadTextFileUseCase } from '../../../use-cases/files/read-text-file.ts';

export function readTextFile(
  server: FastifyInstance,
  options: { useCase: Pick<ReadTextFileUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readTextFileEndpoint.method,
    url: readTextFileEndpoint.path,
    schema: readTextFileEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  });
}
