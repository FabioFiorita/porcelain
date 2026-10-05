import {
  PublicAccessApi,
  BrowserAccessApi,
  PairingApi,
  SessionApi,
  ServiceUpdatesApi,
  HostAccessApi,
  OwnerAccessApi,
} from '@porcelain/contracts/access';
import { RequestCaller, RequestConnection } from '@porcelain/contracts/shared';
import { Effect, Layer } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { effectRoutes } from '../../effect-bridge.ts';
import type { ClearBrowserSessionUseCase } from '../../../use-cases/access/clear-browser-session.ts';
import type { IssueLiveTicketUseCase } from '../../../use-cases/access/issue-live-ticket.ts';
import type { IssuePairingUseCase } from '../../../use-cases/access/issue-pairing.ts';
import type { ListAccessUseCase } from '../../../use-cases/access/list-access.ts';
import type { ReadEnvironmentUseCase } from '../../../use-cases/access/read-environment.ts';
import type { ReadHealthUseCase } from '../../../use-cases/access/read-health.ts';
import type { ReadOwnerStatusUseCase } from '../../../use-cases/access/read-owner-status.ts';
import type { ReadRemoteAccessUseCase } from '../../../use-cases/access/read-remote-access.ts';
import type { ReadServiceUpdateUseCase } from '../../../use-cases/access/read-service-update.ts';
import type { ReadSessionUseCase } from '../../../use-cases/access/read-session.ts';
import type { RedeemPairingUseCase } from '../../../use-cases/access/redeem-pairing.ts';
import type { RenameEnvironmentUseCase } from '../../../use-cases/access/rename-environment.ts';
import type { RevokeAccessUseCase } from '../../../use-cases/access/revoke-access.ts';
import type { SetDeviceTrustUseCase } from '../../../use-cases/access/set-device-trust.ts';
import type { SetRemoteAccessUseCase } from '../../../use-cases/access/set-remote-access.ts';
import type { StartServiceUpdateUseCase } from '../../../use-cases/access/start-service-update.ts';

type AccessUseCases = {
  clearBrowserSession: Pick<ClearBrowserSessionUseCase, 'execute'>;
  issueLiveTicket: Pick<IssueLiveTicketUseCase, 'execute'>;
  issuePairing: Pick<IssuePairingUseCase, 'execute'>;
  listAccess: Pick<ListAccessUseCase, 'execute'>;
  readEnvironment: Pick<ReadEnvironmentUseCase, 'execute'>;
  readHealth: Pick<ReadHealthUseCase, 'execute'>;
  readOwnerStatus: Pick<ReadOwnerStatusUseCase, 'execute'>;
  readRemoteAccess: Pick<ReadRemoteAccessUseCase, 'execute'>;
  readServiceUpdate: Pick<ReadServiceUpdateUseCase, 'execute'>;
  readSession: Pick<ReadSessionUseCase, 'execute'>;
  redeemPairing: Pick<RedeemPairingUseCase, 'execute'>;
  renameEnvironment: Pick<RenameEnvironmentUseCase, 'execute'>;
  revokeAccess: Pick<RevokeAccessUseCase, 'execute'>;
  setDeviceTrust: Pick<SetDeviceTrustUseCase, 'execute'>;
  setRemoteAccess: Pick<SetRemoteAccessUseCase, 'execute'>;
  startServiceUpdate: Pick<StartServiceUpdateUseCase, 'execute'>;
};

function administrationHandlers(useCases: AccessUseCases) {
  return {
    listAccess: () =>
      Effect.flatMap(RequestCaller, (viewer) =>
        useCases.listAccess.execute({ viewer }),
      ),
    issuePairing: ({
      payload,
    }: {
      payload: Parameters<IssuePairingUseCase['execute']>[0];
    }) => useCases.issuePairing.execute(payload),
    revokeAccess: ({
      payload,
    }: {
      payload: Parameters<RevokeAccessUseCase['execute']>[0];
    }) => useCases.revokeAccess.execute(payload),
    setDeviceTrust: ({
      payload,
    }: {
      payload: Parameters<SetDeviceTrustUseCase['execute']>[0];
    }) => useCases.setDeviceTrust.execute(payload),
    readRemoteAccess: () => useCases.readRemoteAccess.execute(),
    setRemoteAccess: ({
      payload,
    }: {
      payload: Parameters<SetRemoteAccessUseCase['execute']>[0];
    }) => useCases.setRemoteAccess.execute(payload),
  };
}

export function accessRoutes(useCases: AccessUseCases) {
  const administration = administrationHandlers(useCases);
  const hostAdministration = HttpApiBuilder.group(
    HostAccessApi,
    'administration',
    (handlers) =>
      handlers
        .handle('listAccess', administration.listAccess)
        .handle('issuePairing', administration.issuePairing)
        .handle('revokeAccess', administration.revokeAccess)
        .handle('setDeviceTrust', administration.setDeviceTrust)
        .handle('readRemoteAccess', administration.readRemoteAccess)
        .handle('setRemoteAccess', administration.setRemoteAccess),
  );
  const ownerAdministration = HttpApiBuilder.group(
    OwnerAccessApi,
    'administration',
    (handlers) =>
      handlers
        .handle('listAccess', administration.listAccess)
        .handle('issuePairing', administration.issuePairing)
        .handle('revokeAccess', administration.revokeAccess)
        .handle('setDeviceTrust', administration.setDeviceTrust)
        .handle('readRemoteAccess', administration.readRemoteAccess)
        .handle('setRemoteAccess', administration.setRemoteAccess),
  );
  const publicHandlers = HttpApiBuilder.group(
    PublicAccessApi,
    'publicAccess',
    (handlers) =>
      handlers
        .handle('readHealth', () => useCases.readHealth.execute())
        .handle('readEnvironment', () => useCases.readEnvironment.execute()),
  );
  const browserHandlers = HttpApiBuilder.group(
    BrowserAccessApi,
    'browserAccess',
    (handlers) =>
      handlers.handle('clearBrowserSession', () =>
        useCases.clearBrowserSession.execute(),
      ),
  );
  const pairingHandlers = HttpApiBuilder.group(
    PairingApi,
    'pairing',
    (handlers) =>
      handlers.handle('redeemPairing', ({ payload }) =>
        Effect.flatMap(RequestConnection, ({ route }) =>
          useCases.redeemPairing.execute({ ...payload, route }),
        ),
      ),
  );
  const sessionHandlers = HttpApiBuilder.group(
    SessionApi,
    'session',
    (handlers) =>
      handlers
        .handle('readSession', () =>
          Effect.flatMap(RequestCaller, (viewer) =>
            useCases.readSession.execute({ viewer }),
          ),
        )
        .handle('issueLiveTicket', () =>
          Effect.gen(function* () {
            const viewer = yield* RequestCaller;
            const { route } = yield* RequestConnection;
            return yield* useCases.issueLiveTicket.execute({ viewer, route });
          }),
        ),
  );
  const updatesHandlers = HttpApiBuilder.group(
    ServiceUpdatesApi,
    'serviceUpdates',
    (handlers) =>
      handlers
        .handle('readServiceUpdate', () =>
          Effect.gen(function* () {
            const viewer = yield* RequestCaller;
            const { local } = yield* RequestConnection;
            return yield* useCases.readServiceUpdate.execute({ viewer, local });
          }),
        )
        .handle('startServiceUpdate', ({ payload }) =>
          Effect.gen(function* () {
            const viewer = yield* RequestCaller;
            const { local } = yield* RequestConnection;
            return yield* useCases.startServiceUpdate.execute({
              version: payload.version,
              viewer,
              local,
            });
          }),
        ),
  );
  const environmentName = HttpApiBuilder.group(
    HostAccessApi,
    'environmentName',
    (handlers) =>
      handlers.handle('renameEnvironment', ({ payload }) =>
        useCases.renameEnvironment.execute(payload),
      ),
  );
  const ownerStatus = HttpApiBuilder.group(
    OwnerAccessApi,
    'ownerStatus',
    (handlers) =>
      handlers.handle('readOwnerStatus', () =>
        useCases.readOwnerStatus.execute(),
      ),
  );
  return {
    public: effectRoutes(
      PublicAccessApi,
      HttpApiBuilder.layer(PublicAccessApi).pipe(Layer.provide(publicHandlers)),
    ),
    browser: effectRoutes(
      BrowserAccessApi,
      HttpApiBuilder.layer(BrowserAccessApi).pipe(
        Layer.provide(browserHandlers),
      ),
    ),
    pairing: effectRoutes(
      PairingApi,
      HttpApiBuilder.layer(PairingApi).pipe(Layer.provide(pairingHandlers)),
    ),
    session: effectRoutes(
      SessionApi,
      HttpApiBuilder.layer(SessionApi).pipe(Layer.provide(sessionHandlers)),
    ),
    updates: effectRoutes(
      ServiceUpdatesApi,
      HttpApiBuilder.layer(ServiceUpdatesApi).pipe(
        Layer.provide(updatesHandlers),
      ),
    ),
    host: effectRoutes(
      HostAccessApi,
      HttpApiBuilder.layer(HostAccessApi).pipe(
        Layer.provide(Layer.merge(hostAdministration, environmentName)),
      ),
    ),
    owner: effectRoutes(
      OwnerAccessApi,
      HttpApiBuilder.layer(OwnerAccessApi).pipe(
        Layer.provide(Layer.merge(ownerAdministration, ownerStatus)),
      ),
    ),
  };
}
