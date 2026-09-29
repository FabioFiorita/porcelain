import type {
  NetworkAddressReader,
  PairingReachReader,
  RouteListenerRunner,
  RuntimeStatusReader,
  TunnelProbe,
} from '@porcelain/access/ports';
import {
  CheckLocalRequestService,
  CheckRequestOriginService,
  IdentifyRequestClientService,
  OpenRemoteRoutesService,
  ReadRemoteAccessService,
  SetRemoteAccessService,
  AuthenticateDeviceService,
  FlushDeviceActivityService,
  IssuePairingService,
  ListAccessService,
  ReadOwnerStatusService,
  RedeemPairingService,
  RefundPairingAttemptService,
  RevokeDeviceService,
  RevokePairingGrantService,
  TakePairingAttemptService,
} from '@porcelain/access/services';
import { RandomSecretSource } from '../adapters/runtime/random-secret-source.ts';
import type { DeviceConnectionStore } from '../ports/device-connection-store.ts';
import { AuthenticateDeviceUseCase } from '../use-cases/access/authenticate-device.ts';
import { CheckLocalRequestUseCase } from '../use-cases/access/check-local-request.ts';
import { CheckRequestOriginUseCase } from '../use-cases/access/check-request-origin.ts';
import { IdentifyRequestClientUseCase } from '../use-cases/access/identify-request-client.ts';
import { OpenRemoteRoutesUseCase } from '../use-cases/access/open-remote-routes.ts';
import { ReadRemoteAccessUseCase } from '../use-cases/access/read-remote-access.ts';
import { SetRemoteAccessUseCase } from '../use-cases/access/set-remote-access.ts';
import { ClearBrowserSessionUseCase } from '../use-cases/access/clear-browser-session.ts';
import { FlushDeviceActivityUseCase } from '../use-cases/access/flush-device-activity.ts';
import { IssuePairingUseCase } from '../use-cases/access/issue-pairing.ts';
import { ListAccessUseCase } from '../use-cases/access/list-access.ts';
import { ReadHealthUseCase } from '../use-cases/access/read-health.ts';
import { ReadOwnerStatusUseCase } from '../use-cases/access/read-owner-status.ts';
import { RedeemPairingUseCase } from '../use-cases/access/redeem-pairing.ts';
import { RefundPairingAttemptUseCase } from '../use-cases/access/refund-pairing-attempt.ts';
import { RevokeAccessUseCase } from '../use-cases/access/revoke-access.ts';
import { TakePairingAttemptUseCase } from '../use-cases/access/take-pairing-attempt.ts';
import type { ComposeContext } from './compose-context.ts';
import type { Shared } from './compose-shared.ts';
import type { Stores } from './compose-stores.ts';

type AccessDependencies = {
  stores: Stores;
  shared: Shared;
  deviceConnections: DeviceConnectionStore;
  pairingReachReader: PairingReachReader;
  runtimeStatusReader: RuntimeStatusReader;
  networkAddressReader: NetworkAddressReader;
  routeListenerRunner: RouteListenerRunner;
  tunnelProbe: TunnelProbe;
};

export function composeAccess(
  context: ComposeContext,
  dependencies: AccessDependencies,
) {
  const { lanes, laneKeys, clock, ids, logger } = context;
  const { stores } = dependencies;
  const { remoteAccess, routeStates } = stores;
  const openRemoteRoutes = new OpenRemoteRoutesService(
    remoteAccess,
    routeStates,
    dependencies.networkAddressReader,
    dependencies.routeListenerRunner,
    dependencies.tunnelProbe,
  );
  const { readEnvironment } = dependencies.shared;
  const limits = context.settings.limits.access;
  const deviceStore = stores.devices;
  const deviceSightingStore = stores.deviceSightings;
  const { pairingGrants, pairingAttempts } = stores;
  const secretSource = new RandomSecretSource(limits.credentials);
  return {
    authenticateDevice: new AuthenticateDeviceUseCase(
      new AuthenticateDeviceService(
        deviceStore,
        deviceSightingStore,
        clock,
        limits.device,
      ),
      lanes,
      laneKeys,
    ),
    clearBrowserSession: new ClearBrowserSessionUseCase(lanes),
    checkRequestOrigin: new CheckRequestOriginUseCase(
      new CheckRequestOriginService(remoteAccess, routeStates),
      lanes,
    ),
    identifyRequestClient: new IdentifyRequestClientUseCase(
      new IdentifyRequestClientService(remoteAccess, routeStates),
      lanes,
    ),
    checkLocalRequest: new CheckLocalRequestUseCase(
      new CheckLocalRequestService(),
      lanes,
    ),
    readRemoteAccess: new ReadRemoteAccessUseCase(
      new ReadRemoteAccessService(
        remoteAccess,
        routeStates,
        dependencies.runtimeStatusReader,
      ),
      lanes,
      laneKeys,
    ),
    setRemoteAccess: new SetRemoteAccessUseCase(
      new SetRemoteAccessService(
        remoteAccess,
        routeStates,
        dependencies.runtimeStatusReader,
        { hostnameLength: limits.remoteAccess.hostnameLength },
      ),
      openRemoteRoutes,
      readEnvironment,
      lanes,
      laneKeys,
      logger,
    ),
    openRemoteRoutes: new OpenRemoteRoutesUseCase(
      openRemoteRoutes,
      readEnvironment,
      lanes,
      laneKeys,
    ),
    flushDeviceActivity: new FlushDeviceActivityUseCase(
      new FlushDeviceActivityService(deviceSightingStore, deviceStore),
      lanes,
      laneKeys,
    ),
    issuePairing: new IssuePairingUseCase(
      readEnvironment,
      new IssuePairingService(
        pairingGrants,
        dependencies.pairingReachReader,
        clock,
        ids,
        secretSource,
        {
          lifetimeMs: limits.pairingGrant.lifetimeMs,
          labelLength: limits.deviceDetails.labelLength,
        },
      ),
      lanes,
      laneKeys,
    ),
    listAccess: new ListAccessUseCase(
      new ListAccessService(pairingGrants, deviceStore, clock),
      lanes,
      laneKeys,
    ),
    readHealth: new ReadHealthUseCase(readEnvironment, lanes, laneKeys),
    readOwnerStatus: new ReadOwnerStatusUseCase(
      new ReadOwnerStatusService(dependencies.runtimeStatusReader),
      lanes,
      laneKeys,
    ),
    redeemPairing: new RedeemPairingUseCase(
      new RedeemPairingService(
        pairingGrants,
        clock,
        ids,
        secretSource,
        limits.deviceDetails,
      ),
      lanes,
      laneKeys,
    ),
    takePairingAttempt: new TakePairingAttemptUseCase(
      new TakePairingAttemptService(
        pairingAttempts,
        clock,
        limits.pairingAttempts,
      ),
      lanes,
      laneKeys,
    ),
    refundPairingAttempt: new RefundPairingAttemptUseCase(
      new RefundPairingAttemptService(
        pairingAttempts,
        clock,
        limits.pairingAttempts,
      ),
      lanes,
      laneKeys,
    ),
    revokeAccess: new RevokeAccessUseCase(
      new RevokePairingGrantService(pairingGrants, clock),
      new RevokeDeviceService(deviceStore, deviceSightingStore, clock),
      dependencies.deviceConnections,
      lanes,
      laneKeys,
    ),
  };
}
