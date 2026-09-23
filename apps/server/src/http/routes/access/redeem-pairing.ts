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
    },
    async (request, reply) => {
      const peer = request.ip ?? 'unknown';
      if (!limit.take(peer))
        return reply.code(429).send({
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Too many pairing attempts. Wait a moment and try again.',
        });
      const { device, credential } = await options.controller.execute(
        request.body,
      );
      limit.refund(peer);
      const summary = {
        id: device.id,
        label: device.label,
        platform: device.platform,
        createdAt: device.createdAt,
      };
      if (request.headers['x-porcelain-browser'] === '1') {
        setDeviceCookie(reply, credential, request.protocol === 'https');
        return { device: summary };
      }
      return { device: summary, credential };
    },
  );
}
