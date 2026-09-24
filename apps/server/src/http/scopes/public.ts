import type { FastifyInstance } from 'fastify';
import type { ReadHealthUseCase } from '../../use-cases/access/read-health.ts';
import type { RedeemPairingUseCase } from '../../use-cases/access/redeem-pairing.ts';
import {
  AttemptLimit,
  refundSucceededAttempt,
  takeAttempt,
} from '../hooks/attempt-limit.ts';
import type { AuthenticateOptions } from '../hooks/authenticate.ts';
import { deliverBrowserCredential } from '../hooks/browser-credential.ts';
import { preventCaching } from '../hooks/prevent-caching.ts';
import type { RequestOriginOptions } from '../hooks/request-origin.ts';
import { clearBrowserSession } from '../protocol/clear-browser-session.ts';
import {
  liveUpdates,
  type LiveUpdatesOptions,
} from '../protocol/live-updates.ts';
import { readHealth } from '../routes/access/read-health.ts';
import { redeemPairing } from '../routes/access/redeem-pairing.ts';

export type PublicUseCases = AuthenticateOptions &
  Pick<RequestOriginOptions, 'access'> &
  LiveUpdatesOptions & {
    access: {
      readHealth: Pick<ReadHealthUseCase, 'execute'>;
      redeemPairing: Pick<RedeemPairingUseCase, 'execute'>;
    };
  };

export async function publicScope(
  server: FastifyInstance,
  options: {
    application: PublicUseCases;
    allowedHosts: readonly string[];
  },
) {
  const { application } = options;
  server.addHook('onRequest', preventCaching);
  server.register(liveUpdates, {
    access: application.access,
    devices: application.devices,
    liveUpdates: application.liveUpdates,
    allowedHosts: options.allowedHosts,
  });
  server.register(clearBrowserSession);
  server.register(readHealth, {
    useCase: application.access.readHealth,
  });
  server.register(async (pairing) => {
    const limit = new AttemptLimit();
    pairing.addHook('preHandler', takeAttempt(limit));
    pairing.addHook('onResponse', refundSucceededAttempt(limit));
    pairing.addHook('preSerialization', deliverBrowserCredential);
    pairing.register(redeemPairing, {
      useCase: application.access.redeemPairing,
    });
  });
}
