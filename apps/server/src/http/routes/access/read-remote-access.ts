import { readRemoteAccessEndpoint } from '@porcelain/contracts/access';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { ReadRemoteAccessUseCase } from '../../../use-cases/access/read-remote-access.ts';

export function readRemoteAccess(
  server: FastifyInstance,
  options: { useCase: Pick<ReadRemoteAccessUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: readRemoteAccessEndpoint.method,
    url: readRemoteAccessEndpoint.path,
    schema: readRemoteAccessEndpoint.schema,
    handler: (request) =>
      options.useCase.execute({ signal: request.disconnected }),
  });
}
