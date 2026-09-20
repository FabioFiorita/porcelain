import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import {
  redeemedPairingSchema,
  redeemPairingSchema,
} from '@porcelain/contracts/pairing';
import type { FastifyInstance } from 'fastify';
import type { Application } from '../../application.ts';
import { TooManyAttemptsError } from '../errors/too-many-attempts-error.ts';
import { setDeviceCookie } from '../middlewares/browser-session.ts';
import { preventCaching } from '../middlewares/prevent-caching.ts';
import { errorResponses } from '../schemas/error-responses.ts';
import { AttemptLimit } from './attempt-limit.ts';

/**
 * The only unauthenticated write on the network door, so it carries its own
 * limit. A 256-bit code makes guessing hopeless, but nothing about entropy
 * stops a flood of valid-shaped codes from forcing a synchronous SQLite read
 * and a hash on the event loop every other request shares.
 */
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
      if (!limit.take(request.ip ?? 'unknown'))
        throw new TooManyAttemptsError();
      const { code, platform, label } = request.body;
      const { device, credential } = await options.application.redeemPairing(
        code,
        { platform, ...(label === undefined ? {} : { label }) },
      );
      const summary = {
        id: device.id,
        label: device.label,
        platform: device.platform,
        createdAt: device.createdAt,
      };
      // A browser keeps its credential where script cannot read it, so it must
      // not also arrive in the body; anything else gets the credential itself.
      if (request.headers['x-porcelain-browser'] === '1') {
        setDeviceCookie(reply, credential, request.protocol === 'https');
        return { device: summary };
      }
      return { device: summary, credential };
    },
  );
}
