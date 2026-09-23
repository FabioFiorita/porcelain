import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  redeemPairingRequestSchema,
  redeemPairingResponseSchema,
} from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { RedeemPairingController } from '../../../controllers/redeem-pairing-controller.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

export function redeemPairing(
  server: FastifyInstance,
  options: { controller: Pick<RedeemPairingController, 'execute'> },
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
      options.controller.execute(request.body, {
        signal: request.disconnected,
      }),
  );
}
