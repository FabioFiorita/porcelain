import type { FastifyInstance } from 'fastify';
import type { ReadHealthController } from '../../controllers/read-health-controller.ts';
import type { RedeemPairingController } from '../../controllers/redeem-pairing-controller.ts';
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

export type PublicControllers = AuthenticateOptions &
  Pick<RequestOriginOptions, 'checkRequestOriginController'> &
  LiveUpdatesOptions & {
    readHealthController: Pick<ReadHealthController, 'execute'>;
    redeemPairingController: Pick<RedeemPairingController, 'execute'>;
  };

export async function publicScope(
  server: FastifyInstance,
  options: {
    application: PublicControllers;
    allowedHosts: readonly string[];
  },
) {
  const { application } = options;
  server.addHook('onRequest', preventCaching);
  server.register(liveUpdates, {
    authenticateDeviceController: application.authenticateDeviceController,
    devices: application.devices,
    liveUpdates: application.liveUpdates,
    checkRequestOriginController: application.checkRequestOriginController,
    allowedHosts: options.allowedHosts,
  });
  server.register(clearBrowserSession);
  server.register(readHealth, {
    controller: application.readHealthController,
  });
  server.register(async (pairing) => {
    const limit = new AttemptLimit();
    pairing.addHook('preHandler', takeAttempt(limit));
    pairing.addHook('onResponse', refundSucceededAttempt(limit));
    pairing.addHook('preSerialization', deliverBrowserCredential);
    pairing.register(redeemPairing, {
      controller: application.redeemPairingController,
    });
  });
}
