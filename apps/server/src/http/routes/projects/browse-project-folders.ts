import { browseProjectFoldersEndpoint } from '@porcelain/contracts/projects';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { BrowseProjectFoldersUseCase } from '../../../use-cases/projects/browse-project-folders.ts';

export function browseProjectFolders(
  server: FastifyInstance,
  options: { useCase: Pick<BrowseProjectFoldersUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: browseProjectFoldersEndpoint.method,
    url: browseProjectFoldersEndpoint.path,
    schema: browseProjectFoldersEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(request.query, {
        signal: request.disconnected,
      }),
  });
}
