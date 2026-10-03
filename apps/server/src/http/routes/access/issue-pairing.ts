import { issuePairingEndpoint } from '@porcelain/contracts/access';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { IssuePairingUseCase } from '../../../use-cases/access/issue-pairing.ts';

export function issuePairing(
  server: FastifyInstance,
  options: { useCase: Pick<IssuePairingUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: issuePairingEndpoint.method,
    url: issuePairingEndpoint.path,
    schema: issuePairingEndpoint.schema,
    handler: (request) =>
      options.useCase.execute(request.body, {
        signal: request.disconnected,
      }),
  });
}
