import { renameEnvironmentEndpoint } from '@porcelain/contracts/access';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { RenameEnvironmentUseCase } from '../../../use-cases/access/rename-environment.ts';

export function renameEnvironment(
  server: FastifyInstance,
  options: { useCase: Pick<RenameEnvironmentUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: renameEnvironmentEndpoint.method,
    url: renameEnvironmentEndpoint.path,
    schema: renameEnvironmentEndpoint.schema,
    handler: (request) =>
      options.useCase.execute(request.body, {
        signal: request.disconnected,
      }),
  });
}
