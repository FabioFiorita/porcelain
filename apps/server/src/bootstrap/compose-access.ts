import type {
  NetworkAddressReader,
  PairingReachReader,
  RouteListenerRunner,
  RuntimeStatusReader,
  TunnelProbe,
} from '@porcelain/access/ports';
import {
  AuthenticateDesktopSessionService,
  AuthorizeServiceUpdateService,
  CheckLocalRequestService,
  CheckRequestOriginService,
  CloseTunnelConnectionsService,
  IdentifyRequestClientService,
  OpenRemoteRoutesService,
  ReadRemoteAccessService,
  RenameEnvironmentService,
  CheckServiceUpdateService,
  PlanServiceUpdateCheckService,
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
  SetDeviceTrustService,
  TakePairingAttemptService,
  IssueLiveTicketService,
  RedeemLiveTicketService,
} from '@porcelain/access/services';
import { InMemoryLiveTicketStore } from '../adapters/access/in-memory-live-ticket-store.ts';
import { RandomSecretSource } from '../adapters/runtime/random-secret-source.ts';
import type { DeviceConnectionStore } from '../ports/device-connection-store.ts';
import type { TunnelConnectionStore } from '../ports/tunnel-connection-store.ts';
import { AuthenticateDeviceUseCase } from '../use-cases/access/authenticate-device.ts';
import { CheckLocalRequestUseCase } from '../use-cases/access/check-local-request.ts';
import { CloseRemoteRoutesUseCase } from '../use-cases/access/close-remote-routes.ts';
import { CheckRequestOriginUseCase } from '../use-cases/access/check-request-origin.ts';
import { IdentifyRequestClientUseCase } from '../use-cases/access/identify-request-client.ts';
import { OpenRemoteRoutesUseCase } from '../use-cases/access/open-remote-routes.ts';
import { ReadRemoteAccessUseCase } from '../use-cases/access/read-remote-access.ts';
import { SetRemoteAccessUseCase } from '../use-cases/access/set-remote-access.ts';
import { RenameEnvironmentUseCase } from '../use-cases/access/rename-environment.ts';
import { ReadServiceUpdateUseCase } from '../use-cases/access/read-service-update.ts';
import { StartServiceUpdateUseCase } from '../use-cases/access/start-service-update.ts';
import type { ServiceUpdateRunner } from '../ports/service-update-runner.ts';
import { ClearBrowserSessionUseCase } from '../use-cases/access/clear-browser-session.ts';
import { FlushDeviceActivityUseCase } from '../use-cases/access/flush-device-activity.ts';
import { IssueLiveTicketUseCase } from '../use-cases/access/issue-live-ticket.ts';
import { IssuePairingUseCase } from '../use-cases/access/issue-pairing.ts';
import { RedeemLiveTicketUseCase } from '../use-cases/access/redeem-live-ticket.ts';
import { ListAccessUseCase } from '../use-cases/access/list-access.ts';
import { ReadEnvironmentUseCase } from '../use-cases/access/read-environment.ts';
import { ReadHealthUseCase } from '../use-cases/access/read-health.ts';
import { ReadSessionUseCase } from '../use-cases/access/read-session.ts';
import { ReadOwnerStatusUseCase } from '../use-cases/access/read-owner-status.ts';
import { RedeemPairingUseCase } from '../use-cases/access/redeem-pairing.ts';
import { RefundPairingAttemptUseCase } from '../use-cases/access/refund-pairing-attempt.ts';
import { RevokeAccessUseCase } from '../use-cases/access/revoke-access.ts';
import { SetDeviceTrustUseCase } from '../use-cases/access/set-device-trust.ts';
import { TakePairingAttemptUseCase } from '../use-cases/access/take-pairing-attempt.ts';
import type { ComposeContext } from './compose-context.ts';
import type { Shared } from './compose-shared.ts';
import type { Stores } from './compose-stores.ts';
import type { ServerHost } from '../ports/server-host.ts';

type AccessDependencies = {
  stores: Stores;
  desktopSession: ServerHost['desktopSession'];
  shared: Shared;
  deviceConnections: DeviceConnectionStore;
  tunnelConnections: TunnelConnectionStore;
  pairingReachReader: PairingReachReader;
  runtimeStatusReader: RuntimeStatusReader;
  serviceUpdateRunner: ServiceUpdateRunner;
  serverVersion: string | undefined;
  networkAddressReader: NetworkAddressReader;
  routeListenerRunner: RouteListenerRunner;
  tunnelProbe: TunnelProbe;
};

const LOOPBACK_ADDRESS = '127.0.0.1';

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
    { loopbackAddress: LOOPBACK_ADDRESS },
  );
  const closeTunnelConnections = new CloseTunnelConnectionsService(
    remoteAccess,
    routeStates,
    dependencies.tunnelConnections,
  );
  const { readEnvironment } = dependencies.shared;
  const limits = context.settings.limits.access;
  const deviceStore = stores.devices;
  const deviceSightingStore = stores.deviceSightings;
  const { pairingGrants, pairingAttempts } = stores;
  const secretSource = new RandomSecretSource(limits.credentials);
  const liveTickets = new InMemoryLiveTicketStore();
  const planServiceUpdateCheck = new PlanServiceUpdateCheckService(
    clock,
    limits.serviceUpdate,
  );
  const authorizeServiceUpdate = new AuthorizeServiceUpdateService(deviceStore);
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
      new AuthenticateDesktopSessionService(dependencies.desktopSession),
    ),
    issueLiveTicket: new IssueLiveTicketUseCase(
      new IssueLiveTicketService(
        liveTickets,
        clock,
        ids,
        secretSource,
        limits.liveTicket,
      ),
      lanes,
      laneKeys,
    ),
    redeemLiveTicket: new RedeemLiveTicketUseCase(
      new RedeemLiveTicketService(
        liveTickets,
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
    readServiceUpdate: new ReadServiceUpdateUseCase(
      dependencies.serviceUpdateRunner,
      authorizeServiceUpdate,
      planServiceUpdateCheck,
      lanes,
      laneKeys,
    ),
    startServiceUpdate: new StartServiceUpdateUseCase(
      dependencies.serviceUpdateRunner,
      authorizeServiceUpdate,
      new CheckServiceUpdateService(),
      planServiceUpdateCheck,
      lanes,
      laneKeys,
    ),
    renameEnvironment: new RenameEnvironmentUseCase(
      new RenameEnvironmentService(
        stores.environmentName,
        dependencies.shared.hostNames,
      ),
      lanes,
      laneKeys,
      context.events,
    ),
    readRemoteAccess: new ReadRemoteAccessUseCase(
      new ReadRemoteAccessService(
        remoteAccess,
        routeStates,
        dependencies.runtimeStatusReader,
        dependencies.networkAddressReader,
      ),
      lanes,
      laneKeys,
    ),
    setRemoteAccess: new SetRemoteAccessUseCase(
      new SetRemoteAccessService(
        remoteAccess,
        routeStates,
        dependencies.runtimeStatusReader,
        dependencies.networkAddressReader,
        { hostnameLength: limits.remoteAccess.hostnameLength },
      ),
      openRemoteRoutes,
      closeTunnelConnections,
      readEnvironment,
      lanes,
      laneKeys,
      logger,
    ),
    openRemoteRoutes: new OpenRemoteRoutesUseCase(
      openRemoteRoutes,
      closeTunnelConnections,
      readEnvironment,
      lanes,
      laneKeys,
    ),
    closeRemoteRoutes: new CloseRemoteRoutesUseCase(
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
    readSession: new ReadSessionUseCase(lanes),
    readEnvironment: new ReadEnvironmentUseCase(
      readEnvironment,
      dependencies.shared.readEnvironmentName,
      lanes,
      laneKeys,
      {
        version: dependencies.serverVersion,
        protocol: limits.environment.protocol,
      },
    ),
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
      new TakePairingAttemptService(pairingAttempts, clock, {
        sameOrigin: limits.pairingAttempts,
        crossOrigin: limits.crossOriginPairingAttempts,
      }),
      lanes,
      laneKeys,
    ),
    refundPairingAttempt: new RefundPairingAttemptUseCase(
      new RefundPairingAttemptService(pairingAttempts, clock, {
        sameOrigin: limits.pairingAttempts,
        crossOrigin: limits.crossOriginPairingAttempts,
      }),
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
    setDeviceTrust: new SetDeviceTrustUseCase(
      new SetDeviceTrustService(deviceStore),
      lanes,
      laneKeys,
    ),
  };
}
