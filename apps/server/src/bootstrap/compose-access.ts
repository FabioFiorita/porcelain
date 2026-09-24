import type {
  DeviceActivityStore,
  DeviceStore,
  PairingReachReader,
  RuntimeStatusReader,
} from '@porcelain/access/ports';
import {
  AuthenticateDeviceService,
  CheckRequestOriginService,
  FlushDeviceActivityService,
  IssuePairingService,
  ListAccessService,
  ReadEnvironmentService,
  ReadOwnerStatusService,
  RedeemPairingService,
  RevokeDeviceService,
  RevokePairingGrantService,
} from '@porcelain/access/services';
import type { StorageSession } from '@porcelain/storage';
import {
  createEnvironmentIdentityStore,
  createPairingGrantStore,
} from '@porcelain/storage/access';
import { RandomIdSource } from '../adapters/runtime/random-id-source.ts';
import { SystemClock } from '../adapters/runtime/system-clock.ts';
import { AuthenticateDeviceUseCase } from '../use-cases/access/authenticate-device.ts';
import { CheckRequestOriginUseCase } from '../use-cases/access/check-request-origin.ts';
import { FlushDeviceActivityUseCase } from '../use-cases/access/flush-device-activity.ts';
import { IssuePairingUseCase } from '../use-cases/access/issue-pairing.ts';
import { ListAccessUseCase } from '../use-cases/access/list-access.ts';
import { ReadHealthUseCase } from '../use-cases/access/read-health.ts';
import { ReadOwnerStatusUseCase } from '../use-cases/access/read-owner-status.ts';
import { RedeemPairingUseCase } from '../use-cases/access/redeem-pairing.ts';
import { RevokeAccessUseCase } from '../use-cases/access/revoke-access.ts';
import type { Lanes } from '../runtime/lanes.ts';

export function composeAccess(deps: {
  session: StorageSession;
  lanes: Lanes;
  deviceStore: DeviceStore;
  deviceActivityStore: DeviceActivityStore;
  pairingReachReader: PairingReachReader;
  runtimeStatusReader: RuntimeStatusReader;
}) {
  const clock = new SystemClock();
  const idSource = new RandomIdSource();
  const pairingGrantStore = createPairingGrantStore(deps.session);
  const readEnvironmentService = new ReadEnvironmentService(
    createEnvironmentIdentityStore(deps.session),
  );
  return {
    authenticateDevice: new AuthenticateDeviceUseCase(
      new AuthenticateDeviceService(deps.deviceStore, clock),
    ),
    checkRequestOrigin: new CheckRequestOriginUseCase(
      new CheckRequestOriginService(),
    ),
    flushDeviceActivity: new FlushDeviceActivityUseCase(
      new FlushDeviceActivityService(deps.deviceActivityStore),
      deps.lanes,
    ),
    issuePairing: new IssuePairingUseCase(
      readEnvironmentService,
      new IssuePairingService(
        pairingGrantStore,
        deps.pairingReachReader,
        clock,
        idSource,
      ),
      deps.lanes,
    ),
    listAccess: new ListAccessUseCase(
      new ListAccessService(pairingGrantStore, deps.deviceStore, clock),
      deps.lanes,
    ),
    readHealth: new ReadHealthUseCase(readEnvironmentService),
    readOwnerStatus: new ReadOwnerStatusUseCase(
      new ReadOwnerStatusService(deps.runtimeStatusReader),
    ),
    redeemPairing: new RedeemPairingUseCase(
      new RedeemPairingService(pairingGrantStore, clock, idSource),
      deps.lanes,
    ),
    revokeAccess: new RevokeAccessUseCase(
      new RevokePairingGrantService(pairingGrantStore, clock),
      new RevokeDeviceService(deps.deviceStore, clock),
      deps.lanes,
    ),
  };
}
