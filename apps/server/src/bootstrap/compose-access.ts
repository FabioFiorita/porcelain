import { Effect } from 'effect';
import { accessServicesLayer } from './access-layers.ts';
import { accessRoutes } from '../http/routes/access/access-api.ts';

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
import type { ComposeContext, AccessDependencies } from './compose-context.ts';

export const composeAccess = Effect.fn('composeAccess')(
  function* (context: ComposeContext, dependencies: AccessDependencies) {
    const { lanes, laneKeys, logger } = context;

    const openRemoteRoutes = yield* OpenRemoteRoutesService;
    const closeTunnelConnections = yield* CloseTunnelConnectionsService;
    const { readEnvironment } = dependencies.shared;

    const planServiceUpdateCheck = yield* PlanServiceUpdateCheckService;
    const authorizeServiceUpdate = yield* AuthorizeServiceUpdateService;
    const useCases = {
      authenticateDevice: new AuthenticateDeviceUseCase(
        yield* AuthenticateDeviceService,
        lanes,
        laneKeys,
        yield* AuthenticateDesktopSessionService,
      ),
      issueLiveTicket: new IssueLiveTicketUseCase(
        yield* IssueLiveTicketService,
        lanes,
        laneKeys,
      ),
      redeemLiveTicket: new RedeemLiveTicketUseCase(
        yield* RedeemLiveTicketService,
        lanes,
        laneKeys,
      ),
      clearBrowserSession: new ClearBrowserSessionUseCase(lanes),
      checkRequestOrigin: new CheckRequestOriginUseCase(
        yield* CheckRequestOriginService,
        lanes,
      ),
      identifyRequestClient: new IdentifyRequestClientUseCase(
        yield* IdentifyRequestClientService,
        lanes,
      ),
      checkLocalRequest: new CheckLocalRequestUseCase(
        yield* CheckLocalRequestService,
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
        yield* CheckServiceUpdateService,
        planServiceUpdateCheck,
        lanes,
        laneKeys,
      ),
      renameEnvironment: new RenameEnvironmentUseCase(
        yield* RenameEnvironmentService,
        lanes,
        laneKeys,
        context.events,
      ),
      readRemoteAccess: new ReadRemoteAccessUseCase(
        yield* ReadRemoteAccessService,
        lanes,
        laneKeys,
      ),
      setRemoteAccess: new SetRemoteAccessUseCase(
        yield* SetRemoteAccessService,
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
        yield* FlushDeviceActivityService,
        lanes,
        laneKeys,
      ),
      issuePairing: new IssuePairingUseCase(
        readEnvironment,
        yield* IssuePairingService,
        lanes,
        laneKeys,
      ),
      listAccess: new ListAccessUseCase(
        yield* ListAccessService,
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
          protocol: context.settings.limits.access.environment.protocol,
        },
      ),
      readOwnerStatus: new ReadOwnerStatusUseCase(
        yield* ReadOwnerStatusService,
        lanes,
        laneKeys,
      ),
      redeemPairing: new RedeemPairingUseCase(
        yield* RedeemPairingService,
        lanes,
        laneKeys,
      ),
      takePairingAttempt: new TakePairingAttemptUseCase(
        yield* TakePairingAttemptService,
        lanes,
        laneKeys,
      ),
      refundPairingAttempt: new RefundPairingAttemptUseCase(
        yield* RefundPairingAttemptService,
        lanes,
        laneKeys,
      ),
      revokeAccess: new RevokeAccessUseCase(
        yield* RevokePairingGrantService,
        yield* RevokeDeviceService,
        dependencies.deviceConnections,
        lanes,
        laneKeys,
      ),
      setDeviceTrust: new SetDeviceTrustUseCase(
        yield* SetDeviceTrustService,
        lanes,
        laneKeys,
      ),
    };
    return { ...useCases, routes: accessRoutes(useCases) };
  },
  (program, context, dependencies) =>
    program.pipe(Effect.provide(accessServicesLayer(context, dependencies))),
);
