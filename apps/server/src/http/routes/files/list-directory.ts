import { listDirectoryEndpoint } from '@porcelain/contracts/files';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ListDirectoryUseCase } from '../../../use-cases/files/list-directory.ts';

export function listDirectory(
  server: FastifyInstance,
  options: { useCase: Pick<ListDirectoryUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: listDirectoryEndpoint.method,
    url: listDirectoryEndpoint.path,
    schema: listDirectoryEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.query },
        { signal: request.disconnected },
      ),
  });
}
