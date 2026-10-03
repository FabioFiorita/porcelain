import { revokeAccessEndpoint } from '@porcelain/contracts/access';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { RevokeAccessUseCase } from '../../../use-cases/access/revoke-access.ts';

export function revokeAccess(
  server: FastifyInstance,
  options: { useCase: Pick<RevokeAccessUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: revokeAccessEndpoint.method,
    url: revokeAccessEndpoint.path,
    schema: revokeAccessEndpoint.schema,
    handler: (request) =>
      options.useCase.execute(request.body, {
        signal: request.disconnected,
      }),
  });
}
