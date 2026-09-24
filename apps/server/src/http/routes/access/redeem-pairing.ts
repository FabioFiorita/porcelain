import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  redeemPairingRequestSchema,
  redeemPairingResponseSchema,
} from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { RedeemPairingUseCase } from '../../../use-cases/access/redeem-pairing.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function redeemPairing(
  server: FastifyInstance,
  options: { useCase: Pick<RedeemPairingUseCase, 'execute'> },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/pair',
    {
      schema: {
        body: redeemPairingRequestSchema,
        response: { ...errorResponses, 200: redeemPairingResponseSchema },
      },
    },
    (request) =>
      options.useCase.execute(request.body, {
        signal: request.disconnected,
      }),
  );
}
