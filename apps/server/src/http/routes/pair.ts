import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  redeemedPairingSchema,
  redeemPairingSchema,
} from '@porcelain/contracts/pairing';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { TooManyAttemptsError } from '../errors/too-many-attempts-error.ts';
import { setDeviceCookie } from '../middlewares/device-cookie.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { errorResponses } from '../schemas/error-responses.ts';
import { AttemptLimit } from './attempt-limit.ts';

export async function pairRoutes(
  server: FastifyInstance,
  options: { application: Application },
) {
  const limit = new AttemptLimit();
  server.addHook('onRequest', preventCaching);
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.post(
    '/pair',
    {
      schema: {
        body: redeemPairingSchema,
        response: { ...errorResponses, 200: redeemedPairingSchema },
      },
    },
    async (request, reply) => {
      const peer = request.ip ?? 'unknown';
      if (!limit.take(peer)) throw new TooManyAttemptsError();
      const { code, platform, label } = request.body;
      const { device, credential } = await options.application.redeemPairing(
        code,
        { platform, ...(label === undefined ? {} : { label }) },
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
