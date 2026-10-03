import { renameProjectEndpoint } from '@porcelain/contracts/projects';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { RenameProjectUseCase } from '../../../use-cases/projects/rename-project.ts';

export function renameProject(
  server: FastifyInstance,
  options: { useCase: Pick<RenameProjectUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: renameProjectEndpoint.method,
    url: renameProjectEndpoint.path,
    schema: renameProjectEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(
        { ...request.params, ...request.body },
        { signal: request.disconnected },
      ),
  });
}
