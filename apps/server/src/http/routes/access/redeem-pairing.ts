import { redeemPairingEndpoint } from '@porcelain/contracts/access';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import type { RedeemPairingUseCase } from '../../../use-cases/access/redeem-pairing.ts';

export function redeemPairing(
  server: FastifyInstance,
  options: { useCase: Pick<RedeemPairingUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.route({
    method: redeemPairingEndpoint.method,
    url: redeemPairingEndpoint.path,
    schema: redeemPairingEndpoint.schema,
    handler: (request) =>
      options.useCase.execute(
        { ...request.body, route: request.client.route },
        { signal: request.disconnected },
      ),
  });
}
