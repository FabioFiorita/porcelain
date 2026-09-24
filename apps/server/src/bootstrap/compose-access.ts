import type {
  DeviceActivityWriter,
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
import { RandomSecretSource } from '../adapters/access/random-secret-source.ts';
import { RandomIdSource } from '../adapters/runtime/random-id-source.ts';
import { SystemClock } from '../adapters/runtime/system-clock.ts';
import type { Lanes } from '../runtime/lanes.ts';
import { AuthenticateDeviceUseCase } from '../use-cases/access/authenticate-device.ts';
import { CheckRequestOriginUseCase } from '../use-cases/access/check-request-origin.ts';
import { ClearBrowserSessionUseCase } from '../use-cases/access/clear-browser-session.ts';
import { FlushDeviceActivityUseCase } from '../use-cases/access/flush-device-activity.ts';
import { IssuePairingUseCase } from '../use-cases/access/issue-pairing.ts';
import { ListAccessUseCase } from '../use-cases/access/list-access.ts';
import { ReadHealthUseCase } from '../use-cases/access/read-health.ts';
import { ReadOwnerStatusUseCase } from '../use-cases/access/read-owner-status.ts';
import { RedeemPairingUseCase } from '../use-cases/access/redeem-pairing.ts';
import { RevokeAccessUseCase } from '../use-cases/access/revoke-access.ts';

const limits = {
  pairingGrant: { lifetimeMs: 15 * 60 * 1000 },
  device: { unusedLifetimeMs: 90 * 24 * 60 * 60 * 1000 },
};

export function composeAccess(deps: {
  session: StorageSession;
  lanes: Lanes;
  deviceStore: DeviceStore;
  deviceActivityStore: DeviceActivityWriter;
  pairingReachReader: PairingReachReader;
  runtimeStatusReader: RuntimeStatusReader;
}) {
  const clock = new SystemClock();
  const idSource = new RandomIdSource();
  const secretSource = new RandomSecretSource();
  const pairingGrants = createPairingGrantStore(deps.session);
  const readEnvironment = new ReadEnvironmentService(
    createEnvironmentIdentityStore(deps.session),
  );
  return {
    authenticateDevice: new AuthenticateDeviceUseCase(
      new AuthenticateDeviceService(deps.deviceStore, clock, limits.device),
    ),
    clearBrowserSession: new ClearBrowserSessionUseCase(),
    checkRequestOrigin: new CheckRequestOriginUseCase(
      new CheckRequestOriginService(),
    ),
    flushDeviceActivity: new FlushDeviceActivityUseCase(
      new FlushDeviceActivityService(deps.deviceActivityStore),
      deps.lanes,
    ),
    issuePairing: new IssuePairingUseCase(
      readEnvironment,
      new IssuePairingService(
        pairingGrants,
        deps.pairingReachReader,
        clock,
        idSource,
        secretSource,
        limits.pairingGrant,
      ),
      deps.lanes,
    ),
    listAccess: new ListAccessUseCase(
      new ListAccessService(pairingGrants, deps.deviceStore, clock),
      deps.lanes,
    ),
    readHealth: new ReadHealthUseCase(readEnvironment),
    readOwnerStatus: new ReadOwnerStatusUseCase(
      new ReadOwnerStatusService(deps.runtimeStatusReader),
    ),
    redeemPairing: new RedeemPairingUseCase(
      new RedeemPairingService(pairingGrants, clock, idSource, secretSource),
      deps.lanes,
    ),
    revokeAccess: new RevokeAccessUseCase(
      new RevokePairingGrantService(pairingGrants, clock),
      new RevokeDeviceService(deps.deviceStore, clock),
      deps.lanes,
    ),
  };
}
