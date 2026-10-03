import { registerProjectEndpoint } from '@porcelain/contracts/projects';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { RegisterProjectUseCase } from '../../../use-cases/projects/register-project.ts';

export function registerProject(
  server: FastifyInstance,
  options: { useCase: Pick<RegisterProjectUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: registerProjectEndpoint.method,
    url: registerProjectEndpoint.path,
    schema: registerProjectEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute(request.body, {
        signal: request.disconnected,
      }),
  });
}
