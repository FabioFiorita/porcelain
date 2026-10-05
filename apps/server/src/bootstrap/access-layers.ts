import { Layer } from 'effect';
import {
  OpenRemoteRoutesService,
  CloseTunnelConnectionsService,
  PlanServiceUpdateCheckService,
  AuthorizeServiceUpdateService,
  AuthenticateDeviceService,
  AuthenticateDesktopSessionService,
  IssueLiveTicketService,
  RedeemLiveTicketService,
  CheckRequestOriginService,
  IdentifyRequestClientService,
  CheckLocalRequestService,
  CheckServiceUpdateService,
  RenameEnvironmentService,
  ReadRemoteAccessService,
  SetRemoteAccessService,
  FlushDeviceActivityService,
  IssuePairingService,
  ListAccessService,
  ReadOwnerStatusService,
  RedeemPairingService,
  TakePairingAttemptService,
  RefundPairingAttemptService,
  RevokePairingGrantService,
  RevokeDeviceService,
  SetDeviceTrustService,
} from '@porcelain/access/services';
import {
  RemoteAccessStore,
  RouteStateStore,
  NetworkAddressReader,
  RouteListenerRunner,
  TunnelProbe,
  RemoteRouteOptions,
  TunnelConnectionStore,
  ServiceUpdateCheckOptions,
  DeviceStore,
  DeviceSightingStore,
  AuthenticateDeviceOptions,
  DesktopSession,
  LiveTicketStore,
  IssueLiveTicketOptions,
  RedeemLiveTicketOptions,
  EnvironmentNameStore,
  HostNameReader,
  RuntimeStatusReader,
  RemoteAccessOptions,
  PairingGrantStore,
  PairingReachReader,
  IssuePairingOptions,
  RedeemPairingOptions,
  PairingAttemptBudgetStore,
  TakePairingAttemptOptions,
  RefundPairingAttemptOptions,
} from '@porcelain/access/ports';
import { Clock, IdSource, SecretSource } from '@porcelain/kernel/ports';
import { InMemoryLiveTicketStore } from '../adapters/access/in-memory-live-ticket-store.ts';
import { RandomSecretSource } from '../adapters/runtime/random-secret-source.ts';
import type { ComposeContext } from './compose-context.ts';
import type { AccessDependencies } from './compose-context.ts';

export function accessServicesLayer(
  context: ComposeContext,
  dependencies: AccessDependencies,
) {
  const { clock, ids } = context;
  const { stores } = dependencies;
  const { remoteAccess, routeStates, pairingGrants, pairingAttempts } = stores;
  const deviceStore = stores.devices;
  const deviceSightingStore = stores.deviceSightings;
  const limits = context.settings.limits.access;
  const secretSource = new RandomSecretSource(limits.credentials);
  const liveTickets = new InMemoryLiveTicketStore();
  const LOOPBACK_ADDRESS = '127.0.0.1';
  return Layer.mergeAll(
    OpenRemoteRoutesService.layer,
    CloseTunnelConnectionsService.layer,
    PlanServiceUpdateCheckService.layer,
    AuthorizeServiceUpdateService.layer,
    AuthenticateDeviceService.layer,
    AuthenticateDesktopSessionService.layer,
    IssueLiveTicketService.layer,
    RedeemLiveTicketService.layer,
    CheckRequestOriginService.layer,
    IdentifyRequestClientService.layer,
    CheckLocalRequestService.layer,
    CheckServiceUpdateService.layer,
    RenameEnvironmentService.layer,
    ReadRemoteAccessService.layer,
    SetRemoteAccessService.layer,
    FlushDeviceActivityService.layer,
    IssuePairingService.layer,
    ListAccessService.layer,
    ReadOwnerStatusService.layer,
    RedeemPairingService.layer,
    TakePairingAttemptService.layer,
    RefundPairingAttemptService.layer,
    RevokePairingGrantService.layer,
    RevokeDeviceService.layer,
    SetDeviceTrustService.layer,
  ).pipe(
    Layer.provide([
      Layer.succeed(RemoteAccessStore, remoteAccess),
      Layer.succeed(RouteStateStore, routeStates),
      Layer.succeed(NetworkAddressReader, dependencies.networkAddressReader),
      Layer.succeed(RouteListenerRunner, dependencies.routeListenerRunner),
      Layer.succeed(TunnelProbe, dependencies.tunnelProbe),
      Layer.succeed(RemoteRouteOptions, { loopbackAddress: LOOPBACK_ADDRESS }),
      Layer.succeed(TunnelConnectionStore, dependencies.tunnelConnections),
      Layer.succeed(Clock, clock),
      Layer.succeed(ServiceUpdateCheckOptions, limits.serviceUpdate),
      Layer.succeed(DeviceStore, deviceStore),
      Layer.succeed(DeviceSightingStore, deviceSightingStore),
      Layer.succeed(AuthenticateDeviceOptions, limits.device),
      Layer.succeed(DesktopSession, dependencies.desktopSession),
      Layer.succeed(LiveTicketStore, liveTickets),
      Layer.succeed(IdSource, ids),
      Layer.succeed(SecretSource, secretSource),
      Layer.succeed(IssueLiveTicketOptions, limits.liveTicket),
      Layer.succeed(RedeemLiveTicketOptions, limits.device),
      Layer.succeed(EnvironmentNameStore, stores.environmentName),
      Layer.succeed(HostNameReader, dependencies.shared.hostNames),
      Layer.succeed(RuntimeStatusReader, dependencies.runtimeStatusReader),
      Layer.succeed(RemoteAccessOptions, {
        hostnameLength: limits.remoteAccess.hostnameLength,
      }),
      Layer.succeed(PairingGrantStore, pairingGrants),
      Layer.succeed(PairingReachReader, dependencies.pairingReachReader),
      Layer.succeed(IssuePairingOptions, {
        lifetimeMs: limits.pairingGrant.lifetimeMs,
        labelLength: limits.deviceDetails.labelLength,
      }),
      Layer.succeed(RedeemPairingOptions, limits.deviceDetails),
      Layer.succeed(PairingAttemptBudgetStore, pairingAttempts),
      Layer.succeed(TakePairingAttemptOptions, {
        sameOrigin: limits.pairingAttempts,
        crossOrigin: limits.crossOriginPairingAttempts,
      }),
      Layer.succeed(RefundPairingAttemptOptions, {
        sameOrigin: limits.pairingAttempts,
        crossOrigin: limits.crossOriginPairingAttempts,
      }),
    ]),
  );
}
