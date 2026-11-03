import { requestBody } from '../../hooks/request-body.ts';
import { handlerAudit } from '../../diagnostics.ts';
import {
  PublicAccessApi,
  BrowserAccessApi,
  PairingApi,
  SessionApi,
  PushRegistrationApi,
  ServiceUpdatesApi,
  RemoteAccessApi,
  ReviewGitSettingsApi,
  HostAccessApi,
  SharingApi,
  OwnerAccessApi,
} from '@porcelain/contracts/access';
import type {
  IssuePairingRequest,
  RevokeAccessRequest,
  SetDeviceTrustRequest,
  SetWaysInPermissionRequest,
  SetManagementPermissionRequest,
} from '@porcelain/contracts/access';
import { type SetRemoteAccessRequest } from '@porcelain/contracts/access';
import { RequestCaller, RequestConnection } from '@porcelain/contracts/shared';
import type { Context } from 'effect';
import { Effect, Layer } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { type ClearBrowserSessionUseCase } from '../../../use-cases/access/clear-browser-session.ts';
import { type IssueLiveTicketUseCase } from '../../../use-cases/access/issue-live-ticket.ts';
import { type IssuePairingUseCase } from '../../../use-cases/access/issue-pairing.ts';
import { type ListAccessUseCase } from '../../../use-cases/access/list-access.ts';
import { type ReadEnvironmentUseCase } from '../../../use-cases/access/read-environment.ts';
import { type ReadHealthUseCase } from '../../../use-cases/access/read-health.ts';
import { type ReadOwnerStatusUseCase } from '../../../use-cases/access/read-owner-status.ts';
import { type ReadRemoteAccessUseCase } from '../../../use-cases/access/read-remote-access.ts';
import { type ReadServiceUpdateUseCase } from '../../../use-cases/access/read-service-update.ts';
import { type ReadSessionUseCase } from '../../../use-cases/access/read-session.ts';
import { type RedeemPairingUseCase } from '../../../use-cases/access/redeem-pairing.ts';
import { type RenameEnvironmentUseCase } from '../../../use-cases/access/rename-environment.ts';
import { type SetEnvironmentIconUseCase } from '../../../use-cases/access/set-environment-icon.ts';
import { type ReadReviewGitSettingsUseCase } from '../../../use-cases/access/read-review-git-settings.ts';
import { type SaveReviewGitSettingsUseCase } from '../../../use-cases/access/save-review-git-settings.ts';
import { type SetPushRegistrationUseCase } from '../../../use-cases/access/set-push-registration.ts';
import { type ClearPushRegistrationUseCase } from '../../../use-cases/access/clear-push-registration.ts';
import { type RevokeAccessUseCase } from '../../../use-cases/access/revoke-access.ts';
import { type SetDeviceTrustUseCase } from '../../../use-cases/access/set-device-trust.ts';
import { type SetRemoteAccessUseCase } from '../../../use-cases/access/set-remote-access.ts';
import { type SetManagementPermissionUseCase } from '../../../use-cases/access/set-management-permission.ts';
import { type SetWaysInPermissionUseCase } from '../../../use-cases/access/set-ways-in-permission.ts';
import { type StartServiceUpdateUseCase } from '../../../use-cases/access/start-service-update.ts';

type AccessUseCases = {
  clearBrowserSession: Pick<
    Context.Service.Shape<typeof ClearBrowserSessionUseCase>,
    'execute'
  >;
  issueLiveTicket: Pick<
    Context.Service.Shape<typeof IssueLiveTicketUseCase>,
    'execute'
  >;
  issuePairing: Pick<
    Context.Service.Shape<typeof IssuePairingUseCase>,
    'execute'
  >;
  listAccess: Pick<Context.Service.Shape<typeof ListAccessUseCase>, 'execute'>;
  readEnvironment: Pick<
    Context.Service.Shape<typeof ReadEnvironmentUseCase>,
    'execute'
  >;
  readHealth: Pick<Context.Service.Shape<typeof ReadHealthUseCase>, 'execute'>;
  readOwnerStatus: Pick<
    Context.Service.Shape<typeof ReadOwnerStatusUseCase>,
    'execute'
  >;
  readRemoteAccess: Pick<
    Context.Service.Shape<typeof ReadRemoteAccessUseCase>,
    'execute'
  >;
  readServiceUpdate: Pick<
    Context.Service.Shape<typeof ReadServiceUpdateUseCase>,
    'execute'
  >;
  readSession: Pick<
    Context.Service.Shape<typeof ReadSessionUseCase>,
    'execute'
  >;
  redeemPairing: Pick<
    Context.Service.Shape<typeof RedeemPairingUseCase>,
    'execute'
  >;
  renameEnvironment: Pick<
    Context.Service.Shape<typeof RenameEnvironmentUseCase>,
    'execute'
  >;
  setEnvironmentIcon: Pick<
    Context.Service.Shape<typeof SetEnvironmentIconUseCase>,
    'execute'
  >;
  readReviewGitSettings: Pick<
    Context.Service.Shape<typeof ReadReviewGitSettingsUseCase>,
    'execute'
  >;
  saveReviewGitSettings: Pick<
    Context.Service.Shape<typeof SaveReviewGitSettingsUseCase>,
    'execute'
  >;
  setPushRegistration: Pick<
    Context.Service.Shape<typeof SetPushRegistrationUseCase>,
    'execute'
  >;
  clearPushRegistration: Pick<
    Context.Service.Shape<typeof ClearPushRegistrationUseCase>,
    'execute'
  >;
  revokeAccess: Pick<
    Context.Service.Shape<typeof RevokeAccessUseCase>,
    'execute'
  >;
  setDeviceTrust: Pick<
    Context.Service.Shape<typeof SetDeviceTrustUseCase>,
    'execute'
  >;
  setRemoteAccess: Pick<
    Context.Service.Shape<typeof SetRemoteAccessUseCase>,
    'execute'
  >;
  setManagementPermission: Pick<
    Context.Service.Shape<typeof SetManagementPermissionUseCase>,
    'execute'
  >;
  setWaysInPermission: Pick<
    Context.Service.Shape<typeof SetWaysInPermissionUseCase>,
    'execute'
  >;
  startServiceUpdate: Pick<
    Context.Service.Shape<typeof StartServiceUpdateUseCase>,
    'execute'
  >;
};

function administrationHandlers(useCases: AccessUseCases) {
  return {
    listAccess: () =>
      Effect.gen(function* () {
        const viewer = yield* RequestCaller;
        const { route, local } = yield* RequestConnection;
        return yield* useCases.listAccess.execute({ viewer, route, local });
      }),
    issuePairing: ({ payload }: { payload: IssuePairingRequest }) =>
      Effect.gen(function* () {
        const viewer = yield* RequestCaller;
        const { route, local } = yield* RequestConnection;
        return yield* useCases.issuePairing.execute({
          ...payload,
          viewer,
          route,
          local,
        });
      }),
    revokeAccess: ({ payload }: { payload: RevokeAccessRequest }) =>
      Effect.gen(function* () {
        const viewer = yield* RequestCaller;
        const { route, local } = yield* RequestConnection;
        return yield* useCases.revokeAccess.execute({
          ...payload,
          viewer,
          route,
          local,
        });
      }),
    setDeviceTrust: ({ payload }: { payload: SetDeviceTrustRequest }) =>
      Effect.gen(function* () {
        const viewer = yield* RequestCaller;
        const { route, local } = yield* RequestConnection;
        return yield* useCases.setDeviceTrust.execute({
          ...payload,
          viewer,
          route,
          local,
        });
      }),
    setWaysInPermission: ({
      payload,
    }: {
      payload: SetWaysInPermissionRequest;
    }) =>
      Effect.gen(function* () {
        const viewer = yield* RequestCaller;
        const { route, local } = yield* RequestConnection;
        return yield* useCases.setWaysInPermission.execute({
          ...payload,
          viewer,
          route,
          local,
        });
      }),
    setManagementPermission: ({
      payload,
    }: {
      payload: SetManagementPermissionRequest;
    }) =>
      Effect.gen(function* () {
        const viewer = yield* RequestCaller;
        const { route, local } = yield* RequestConnection;
        return yield* useCases.setManagementPermission.execute({
          ...payload,
          viewer,
          route,
          local,
        });
      }),
  };
}

function remoteAccessHandlers(useCases: AccessUseCases) {
  return {
    readRemoteAccess: () =>
      Effect.gen(function* () {
        const viewer = yield* RequestCaller;
        const { local, route } = yield* RequestConnection;
        return yield* useCases.readRemoteAccess.execute({
          viewer,
          local,
          route,
        });
      }),
    setRemoteAccess: ({ payload }: { payload: SetRemoteAccessRequest }) =>
      Effect.gen(function* () {
        const viewer = yield* RequestCaller;
        const { local, route } = yield* RequestConnection;
        return yield* useCases.setRemoteAccess.execute({
          ...payload,
          viewer,
          local,
          route,
        });
      }),
  };
}

export function accessRoutes(useCases: AccessUseCases) {
  const administration = administrationHandlers(useCases);
  const remoteAccess = remoteAccessHandlers(useCases);
  const pairedRemoteAccess = HttpApiBuilder.group(
    RemoteAccessApi,
    'remoteAccess',
    (handlers) =>
      handlers
        .handle('readRemoteAccess', remoteAccess.readRemoteAccess)
        .handle('setRemoteAccess', remoteAccess.setRemoteAccess),
  );
  const ownerRemoteAccess = HttpApiBuilder.group(
    OwnerAccessApi,
    'remoteAccess',
    (handlers) =>
      handlers
        .handle('readRemoteAccess', remoteAccess.readRemoteAccess)
        .handle('setRemoteAccess', remoteAccess.setRemoteAccess),
  );
  const sharingAdministration = HttpApiBuilder.group(
    SharingApi,
    'administration',
    (handlers) =>
      handlers
        .handle('listAccess', administration.listAccess)
        .handle('issuePairing', administration.issuePairing)
        .handle('revokeAccess', administration.revokeAccess)
        .handle('setDeviceTrust', administration.setDeviceTrust)
        .handle(
          'setManagementPermission',
          administration.setManagementPermission,
        )
        .handle('setWaysInPermission', administration.setWaysInPermission),
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
        .handle(
          'setManagementPermission',
          administration.setManagementPermission,
        )
        .handle('setWaysInPermission', administration.setWaysInPermission),
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
  const pushRegistrationHandlers = HttpApiBuilder.group(
    PushRegistrationApi,
    'pushRegistration',
    (handlers) =>
      handlers
        .handle('setPushRegistration', ({ payload }) =>
          Effect.flatMap(RequestCaller, (viewer) =>
            useCases.setPushRegistration.execute({ ...payload, viewer }),
          ),
        )
        .handle('clearPushRegistration', () =>
          Effect.flatMap(RequestCaller, (viewer) =>
            useCases.clearPushRegistration.execute({ viewer }),
          ),
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
  const reviewGitSettingsHandlers = HttpApiBuilder.group(
    ReviewGitSettingsApi,
    'reviewGitSettings',
    (handlers) =>
      handlers
        .handle('readReviewGitSettings', () =>
          useCases.readReviewGitSettings.execute(),
        )
        .handle('saveReviewGitSettings', ({ payload }) =>
          Effect.gen(function* () {
            const viewer = yield* RequestCaller;
            const { local } = yield* RequestConnection;
            return yield* useCases.saveReviewGitSettings.execute({
              viewer,
              local,
              save: payload,
            });
          }),
        ),
  );
  const environmentLabel = HttpApiBuilder.group(
    HostAccessApi,
    'environmentLabel',
    (handlers) =>
      handlers
        .handle('renameEnvironment', ({ payload }) =>
          useCases.renameEnvironment.execute(payload),
        )
        .handle('setEnvironmentIcon', ({ payload }) =>
          useCases.setEnvironmentIcon.execute(payload),
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
    public: HttpApiBuilder.layer(PublicAccessApi).pipe(
      Layer.provide(publicHandlers),
      Layer.provide(handlerAudit.layer),
      Layer.provide(requestBody.layer),
    ),
    browser: HttpApiBuilder.layer(BrowserAccessApi).pipe(
      Layer.provide(browserHandlers),
      Layer.provide(handlerAudit.layer),
      Layer.provide(requestBody.layer),
    ),
    pairing: HttpApiBuilder.layer(PairingApi).pipe(
      Layer.provide(pairingHandlers),
      Layer.provide(handlerAudit.layer),
      Layer.provide(requestBody.layer),
    ),
    session: HttpApiBuilder.layer(SessionApi).pipe(
      Layer.provide(sessionHandlers),
      Layer.provide(handlerAudit.layer),
      Layer.provide(requestBody.layer),
    ),
    pushRegistration: HttpApiBuilder.layer(PushRegistrationApi).pipe(
      Layer.provide(pushRegistrationHandlers),
      Layer.provide(handlerAudit.layer),
      Layer.provide(requestBody.layer),
    ),
    updates: HttpApiBuilder.layer(ServiceUpdatesApi).pipe(
      Layer.provide(updatesHandlers),
      Layer.provide(handlerAudit.layer),
      Layer.provide(requestBody.layer),
    ),
    remoteAccess: HttpApiBuilder.layer(RemoteAccessApi).pipe(
      Layer.provide(pairedRemoteAccess),
      Layer.provide(handlerAudit.layer),
      Layer.provide(requestBody.layer),
    ),
    reviewGitSettings: HttpApiBuilder.layer(ReviewGitSettingsApi).pipe(
      Layer.provide(reviewGitSettingsHandlers),
      Layer.provide(handlerAudit.layer),
      Layer.provide(requestBody.layer),
    ),
    sharing: HttpApiBuilder.layer(SharingApi).pipe(
      Layer.provide(sharingAdministration),
      Layer.provide(handlerAudit.layer),
      Layer.provide(requestBody.layer),
    ),
    host: HttpApiBuilder.layer(HostAccessApi).pipe(
      Layer.provide(environmentLabel),
      Layer.provide(handlerAudit.layer),
      Layer.provide(requestBody.layer),
    ),
    owner: HttpApiBuilder.layer(OwnerAccessApi).pipe(
      Layer.provide(
        Layer.mergeAll(ownerAdministration, ownerRemoteAccess, ownerStatus),
      ),
      Layer.provide(handlerAudit.layer),
      Layer.provide(requestBody.layer),
    ),
  };
}
