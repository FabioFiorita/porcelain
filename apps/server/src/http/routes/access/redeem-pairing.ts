import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  redeemPairingRequestSchema,
  redeemPairingResponseSchema,
} from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import type { RedeemPairingController } from '../../../controllers/redeem-pairing-controller.ts';
import { AttemptLimit } from '../../middlewares/attempt-limit.ts';
import { setDeviceCookie } from '../../middlewares/device-cookie.ts';
import { preventCaching } from '../../middlewares/prevent-caching.ts';
import { errorResponses } from '../../schemas/error-responses.ts';

const tooManyAttempts = {
  statusCode: 429,
  error: 'Too Many Requests',
  message: 'Too many pairing attempts. Wait a moment and try again.',
};

function withoutCredential(payload: unknown) {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('credential' in payload) ||
    typeof payload.credential !== 'string'
  )
    return undefined;
  const { credential, ...rest } = payload;
  return { credential, rest };
}

export function redeemPairing(
  server: FastifyInstance,
  options: { controller: Pick<RedeemPairingController, 'execute'> },
) {
  const limit = new AttemptLimit();
  server.addHook('onRequest', preventCaching);
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/pair',
    {
      schema: {
        body: redeemPairingRequestSchema,
        response: { ...errorResponses, 200: redeemPairingResponseSchema },
      },
      preHandler: async (request, reply) => {
        if (!limit.take(request.ip))
          return reply.code(429).send(tooManyAttempts);
      },
      onResponse: async (request, reply) => {
        if (reply.statusCode === 200) limit.refund(request.ip);
      },
      preSerialization: async (request, reply, payload: unknown) => {
        const split = withoutCredential(payload);
        if (!split || request.headers['x-porcelain-browser'] !== '1')
          return payload;
        setDeviceCookie(reply, split.credential, request.protocol === 'https');
        return split.rest;
      },
    },
    (request) =>
      options.controller.execute(request.body, {
        signal: request.disconnected,
      }),
  );
}
