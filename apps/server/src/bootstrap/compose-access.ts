import { DeviceConnectionStore } from '../ports/device-connection-store.ts';
import { ReadEnvironmentUseCaseOptions } from '../ports/read-environment-use-case-options.ts';
import { Logger } from '../ports/logger.ts';
import { EventPublisher } from '../ports/event-publisher.ts';
import { ServiceUpdateRunner } from '../ports/service-update-runner.ts';
import { LaneKeys } from '../runtime/lane-keys.ts';
import { Lanes } from '../runtime/lanes.ts';
import { Effect, Layer } from 'effect';
import { accessServicesLayer } from './access-layers.ts';
import { accessRoutes } from '../http/routes/access/access-api.ts';
import {
  ReadEnvironmentService,
  ReadEnvironmentNameService,
} from '@porcelain/access/services';
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
import {
  type ComposeContext,
  type AccessDependencies,
} from './compose-context.ts';

export function composeAccess(
  context: ComposeContext,
  dependencies: AccessDependencies,
) {
  const { lanes, laneKeys, logger } = context;
  const { readEnvironment } = dependencies.shared;
  const ports = Layer.mergeAll(
    Layer.succeed(Lanes, lanes),
    Layer.succeed(LaneKeys, laneKeys),
    Layer.succeed(ServiceUpdateRunner, dependencies.serviceUpdateRunner),
    Layer.succeed(EventPublisher, context.events),
    Layer.succeed(ReadEnvironmentService, readEnvironment),
    Layer.succeed(Logger, logger),
    Layer.succeed(
      ReadEnvironmentNameService,
      dependencies.shared.readEnvironmentName,
    ),
    Layer.succeed(ReadEnvironmentUseCaseOptions, {
      version: dependencies.serverVersion,
      protocol: context.settings.limits.access.environment.protocol,
    }),
    Layer.succeed(DeviceConnectionStore, dependencies.deviceConnections),
  );
  const native = accessServicesLayer(context, dependencies).pipe(
    Layer.provideMerge(ports),
  );
  const services = Layer.mergeAll(
    AuthenticateDeviceUseCase.layer,
    IssueLiveTicketUseCase.layer,
    RedeemLiveTicketUseCase.layer,
    ClearBrowserSessionUseCase.layer,
    CheckRequestOriginUseCase.layer,
    IdentifyRequestClientUseCase.layer,
    CheckLocalRequestUseCase.layer,
    ReadServiceUpdateUseCase.layer,
    StartServiceUpdateUseCase.layer,
    RenameEnvironmentUseCase.layer,
    ReadRemoteAccessUseCase.layer,
    SetRemoteAccessUseCase.layer,
    OpenRemoteRoutesUseCase.layer,
    CloseRemoteRoutesUseCase.layer,
    FlushDeviceActivityUseCase.layer,
    IssuePairingUseCase.layer,
    ListAccessUseCase.layer,
    ReadHealthUseCase.layer,
    ReadSessionUseCase.layer,
    ReadEnvironmentUseCase.layer,
    ReadOwnerStatusUseCase.layer,
    RedeemPairingUseCase.layer,
    TakePairingAttemptUseCase.layer,
    RefundPairingAttemptUseCase.layer,
    RevokeAccessUseCase.layer,
    SetDeviceTrustUseCase.layer,
  ).pipe(Layer.provideMerge(native));
  return Effect.gen(function* () {
    const useCases = {
      authenticateDevice: yield* AuthenticateDeviceUseCase,
      issueLiveTicket: yield* IssueLiveTicketUseCase,
      redeemLiveTicket: yield* RedeemLiveTicketUseCase,
      clearBrowserSession: yield* ClearBrowserSessionUseCase,
      checkRequestOrigin: yield* CheckRequestOriginUseCase,
      identifyRequestClient: yield* IdentifyRequestClientUseCase,
      checkLocalRequest: yield* CheckLocalRequestUseCase,
      readServiceUpdate: yield* ReadServiceUpdateUseCase,
      startServiceUpdate: yield* StartServiceUpdateUseCase,
      renameEnvironment: yield* RenameEnvironmentUseCase,
      readRemoteAccess: yield* ReadRemoteAccessUseCase,
      setRemoteAccess: yield* SetRemoteAccessUseCase,
      openRemoteRoutes: yield* OpenRemoteRoutesUseCase,
      closeRemoteRoutes: yield* CloseRemoteRoutesUseCase,
      flushDeviceActivity: yield* FlushDeviceActivityUseCase,
      issuePairing: yield* IssuePairingUseCase,
      listAccess: yield* ListAccessUseCase,
      readHealth: yield* ReadHealthUseCase,
      readSession: yield* ReadSessionUseCase,
      readEnvironment: yield* ReadEnvironmentUseCase,
      readOwnerStatus: yield* ReadOwnerStatusUseCase,
      redeemPairing: yield* RedeemPairingUseCase,
      takePairingAttempt: yield* TakePairingAttemptUseCase,
      refundPairingAttempt: yield* RefundPairingAttemptUseCase,
      revokeAccess: yield* RevokeAccessUseCase,
      setDeviceTrust: yield* SetDeviceTrustUseCase,
    };
    return { ...useCases, routes: accessRoutes(useCases) };
  }).pipe(Effect.provide(services));
}
