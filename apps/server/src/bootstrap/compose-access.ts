import type { DeviceStore, PairingReachReader } from '@porcelain/access/ports';
import {
  AuthenticateDeviceService,
  IssuePairingService,
  ListAccessService,
  ReadEnvironmentService,
  RedeemPairingService,
  RevokeDeviceService,
  RevokePairingGrantService,
} from '@porcelain/access/services';
import type { StorageSession } from '@porcelain/storage';
import {
  createEnvironmentIdentityStore,
  createPairingGrantStore,
} from '@porcelain/storage/access';
import { RandomIdAdapter } from '../adapters/access/random-id-adapter.ts';
import { SystemClockAdapter } from '../adapters/access/system-clock-adapter.ts';
import { AuthenticateDeviceController } from '../controllers/authenticate-device-controller.ts';
import { IssuePairingController } from '../controllers/issue-pairing-controller.ts';
import { ListAccessController } from '../controllers/list-access-controller.ts';
import { ReadHealthController } from '../controllers/read-health-controller.ts';
import { RedeemPairingController } from '../controllers/redeem-pairing-controller.ts';
import { RevokeAccessController } from '../controllers/revoke-access-controller.ts';
import type { Lanes } from '../runtime/lanes.ts';

export function composeAccess(deps: {
  session: StorageSession;
  lanes: Lanes;
  deviceStore: DeviceStore;
  pairingReachReader: PairingReachReader;
}) {
  const clock = new SystemClockAdapter();
  const idSource = new RandomIdAdapter();
  const pairingGrantStore = createPairingGrantStore(deps.session);
  const readEnvironmentService = new ReadEnvironmentService(
    createEnvironmentIdentityStore(deps.session),
  );
  return {
    authenticateDeviceController: new AuthenticateDeviceController(
      new AuthenticateDeviceService(deps.deviceStore, clock),
    ),
    issuePairingController: new IssuePairingController(
      readEnvironmentService,
      new IssuePairingService(
        pairingGrantStore,
        deps.pairingReachReader,
        clock,
        idSource,
      ),
      deps.lanes,
    ),
    listAccessController: new ListAccessController(
      new ListAccessService(pairingGrantStore, deps.deviceStore, clock),
      deps.lanes,
    ),
    readHealthController: new ReadHealthController(readEnvironmentService),
    redeemPairingController: new RedeemPairingController(
      new RedeemPairingService(pairingGrantStore, clock, idSource),
      deps.lanes,
    ),
    revokeAccessController: new RevokeAccessController(
      new RevokePairingGrantService(pairingGrantStore, clock),
      new RevokeDeviceService(deps.deviceStore, clock),
      deps.lanes,
    ),
  };
}
