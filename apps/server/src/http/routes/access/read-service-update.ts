import { readServiceUpdateEndpoint } from '@porcelain/contracts/access';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadServiceUpdateUseCase } from '../../../use-cases/access/read-service-update.ts';

export function readServiceUpdate(
  server: FastifyInstance,
  options: { useCase: Pick<ReadServiceUpdateUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readServiceUpdateEndpoint.method,
    url: readServiceUpdateEndpoint.path,
    schema: readServiceUpdateEndpoint.schema,
    handler: (request) =>
      options.useCase.execute(
        { viewer: request.caller, local: request.local },
        { signal: request.disconnected },
      ),
  });
}
