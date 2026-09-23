import type { FastifyInstance } from 'fastify';
import type { ReadHealthController } from '../../controllers/read-health-controller.ts';
import type { ReadInventoryController } from '../../controllers/read-inventory-controller.ts';
import type { RedeemPairingController } from '../../controllers/redeem-pairing-controller.ts';
import type { AuthenticateOptions } from '../middlewares/authenticate.ts';
import type { OriginPolicy } from '../middlewares/request-origin.ts';
import { browserSessionRoutes } from '../protocol/clear-browser-session.ts';
import {
  liveUpdateRoutes,
  type LiveUpdatesOptions,
} from '../protocol/live-updates.ts';
import { getBrowserSession } from '../routes/access/get-browser-session.ts';
import { readHealth } from '../routes/access/read-health.ts';
import { redeemPairing } from '../routes/access/redeem-pairing.ts';

export type PublicControllers = {
  readInventoryController: Pick<ReadInventoryController, 'execute'>;
  readHealthController: Pick<ReadHealthController, 'execute'>;
  redeemPairingController: Pick<RedeemPairingController, 'execute'>;
};

export async function publicRoutes(
  server: FastifyInstance,
  options: {
    application: PublicControllers & AuthenticateOptions;
  } & LiveUpdatesOptions &
    OriginPolicy,
) {
  const { application } = options;
  server.register(liveUpdateRoutes, {
    authenticateDeviceController: application.authenticateDeviceController,
    devices: application.devices,
    liveUpdates: options.liveUpdates,
    allowedHosts: options.allowedHosts,
  });
  server.register(browserSessionRoutes);
  server.register(getBrowserSession, {
    authenticateDeviceController: application.authenticateDeviceController,
    devices: application.devices,
    controller: application.readInventoryController,
  });
  server.register(readHealth, {
    controller: application.readHealthController,
  });
  server.register(redeemPairing, {
    controller: application.redeemPairingController,
  });
}
