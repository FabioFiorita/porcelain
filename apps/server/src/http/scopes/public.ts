import type { FastifyInstance } from 'fastify';
import type { ServerCapabilities } from '../../bootstrap/server-capabilities.ts';
import type { OriginPolicy } from '../middlewares/request-origin.ts';
import { browserSessionRoutes } from '../protocol/clear-browser-session.ts';
import { healthRoute } from '../routes/access/health.ts';
import { liveUpdateRoutes } from '../protocol/live-updates.ts';
import { getBrowserSession } from '../routes/access/get-browser-session.ts';
import { redeemPairing } from '../routes/access/redeem-pairing.ts';

export async function publicRoutes(
  server: FastifyInstance,
  options: { application: ServerCapabilities } & OriginPolicy,
) {
  server.register(liveUpdateRoutes, options);
  server.register(browserSessionRoutes, options);
  server.register(getBrowserSession, {
    application: options.application,
    controller: options.application.readInventoryController,
  });
  server.register(healthRoute, {
    controller: options.application.readHealthController,
  });
  server.register(redeemPairing, {
    controller: options.application.redeemPairingController,
  });
}
