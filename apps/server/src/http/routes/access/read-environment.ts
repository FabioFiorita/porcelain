import { readEnvironmentEndpoint } from '@porcelain/contracts/access';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadEnvironmentUseCase } from '../../../use-cases/access/read-environment.ts';

export function readEnvironment(
  server: FastifyInstance,
  options: { useCase: Pick<ReadEnvironmentUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readEnvironmentEndpoint.method,
    url: readEnvironmentEndpoint.path,
    schema: readEnvironmentEndpoint.schema,
    handler: (request) =>
      options.useCase.execute({ signal: request.disconnected }),
  });
}
