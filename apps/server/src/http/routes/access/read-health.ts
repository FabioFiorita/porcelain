import { readHealthEndpoint } from '@porcelain/contracts/access';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadHealthUseCase } from '../../../use-cases/access/read-health.ts';

export function readHealth(
  server: FastifyInstance,
  options: { useCase: Pick<ReadHealthUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readHealthEndpoint.method,
    url: readHealthEndpoint.path,
    schema: readHealthEndpoint.schema,
    handler: async (request) =>
      options.useCase.execute({ signal: request.disconnected }),
  });
}
