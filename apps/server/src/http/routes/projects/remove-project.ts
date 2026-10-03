import { removeProjectEndpoint } from '@porcelain/contracts/projects';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { RemoveProjectUseCase } from '../../../use-cases/projects/remove-project.ts';

export function removeProject(
  server: FastifyInstance,
  options: { useCase: Pick<RemoveProjectUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: removeProjectEndpoint.method,
    url: removeProjectEndpoint.path,
    schema: removeProjectEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  });
}
