import { setRemoteAccessEndpoint } from '@porcelain/contracts/access';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { SetRemoteAccessUseCase } from '../../../use-cases/access/set-remote-access.ts';

export function setRemoteAccess(
  server: FastifyInstance,
  options: { useCase: Pick<SetRemoteAccessUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: setRemoteAccessEndpoint.method,
    url: setRemoteAccessEndpoint.path,
    schema: setRemoteAccessEndpoint.schema,
    handler: (request) =>
      options.useCase.execute(request.body, {
        signal: request.disconnected,
      }),
  });
}
