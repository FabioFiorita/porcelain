import { environmentUnavailable } from '../shared/environment-failure.ts';
import {
  DeviceNotFoundError,
  SharingManagementRequiredError,
  DeviceViewerRequiredError,
  InvalidDeviceDetailsError,
  InvalidPairingAddressError,
  InvalidPairingError,
  InvalidTailnetHostnameError,
  InvalidTunnelHostnameError,
  MissingTailnetHostnameError,
  MissingTunnelHostnameError,
  NoLocalNetworkError,
  ReviewGitSettingsNotConfiguredError,
  ReviewGitSettingsTrustRequiredError,
  ServiceNotManagedError,
  ServiceUpdateNotOfferedError,
  ServiceUpdateRunningError,
  TooManyLiveTicketsError,
  UnidentifiedLocalNetworkError,
  UntrustedDeviceError,
  RemoteRouteInUseError,
  WaysInChangedError,
  WaysInPermissionRequiredError,
  PushRegistrationDeviceRequiredError,
} from '@porcelain/access/errors';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/http-api';
import { porcelainApi } from '../shared/http-api.ts';
import { ClientRequest, PairedRequest } from '../shared/http-caller.ts';
import { httpFailure } from '../shared/http-failure.ts';
import {
  readEnvironmentResponseSchema,
  renameEnvironmentRequestSchema,
  renameEnvironmentResponseSchema,
  setEnvironmentIconRequestSchema,
  setEnvironmentIconResponseSchema,
} from './environment.ts';
import { readHealthResponseSchema } from './health.ts';
import { issueLiveTicketResponseSchema } from './live-updates.ts';
import { readOwnerStatusResponseSchema } from './owner.ts';
import {
  clearBrowserSessionResponseSchema,
  issuePairingRequestSchema,
  issuePairingResponseSchema,
  listAccessResponseSchema,
  redeemPairingRequestSchema,
  redeemPairingResponseSchema,
  revokeAccessRequestSchema,
  revokeAccessResponseSchema,
  setDeviceTrustRequestSchema,
  setDeviceTrustResponseSchema,
  setManagementPermissionRequestSchema,
  setManagementPermissionResponseSchema,
  setWaysInPermissionRequestSchema,
  setWaysInPermissionResponseSchema,
} from './pairing.ts';
import { readSessionResponseSchema } from './principal.ts';
import {
  clearPushRegistrationResponseSchema,
  setPushRegistrationRequestSchema,
  setPushRegistrationResponseSchema,
} from './push-registration.ts';
import {
  readRemoteAccessResponseSchema,
  setRemoteAccessRequestSchema,
  setRemoteAccessResponseSchema,
} from './remote-access.ts';
import {
  readReviewGitSettingsResponseSchema,
  saveReviewGitSettingsRequestSchema,
  saveReviewGitSettingsResponseSchema,
} from './review-git-settings.ts';
import {
  readServiceUpdateResponseSchema,
  startServiceUpdateRequestSchema,
  startServiceUpdateResponseSchema,
} from './service-update.ts';

const invalidDeviceDetails = httpFailure(
  InvalidDeviceDetailsError,
  'BadRequest',
);

const publicGroup = HttpApiGroup.make('publicAccess').add(
  HttpApiEndpoint.get('readHealth', '/health', {
    disableCodecs: true,
    success: readHealthResponseSchema,
    error: environmentUnavailable,
  }),
  HttpApiEndpoint.get('readEnvironment', '/environment', {
    disableCodecs: true,
    success: readEnvironmentResponseSchema,
    error: environmentUnavailable,
  }),
);
const browserGroup = HttpApiGroup.make('browserAccess').add(
  HttpApiEndpoint.delete('clearBrowserSession', '/session', {
    disableCodecs: true,
    success: clearBrowserSessionResponseSchema.pipe(
      HttpApiSchema.asNoContent({ decode: () => undefined }),
      HttpApiSchema.status('NoContent'),
    ),
  }),
);
const pairingGroup = HttpApiGroup.make('pairing')
  .add(
    HttpApiEndpoint.post('redeemPairing', '/pair', {
      disableCodecs: true,
      payload: redeemPairingRequestSchema,
      success: redeemPairingResponseSchema,
      error: [
        invalidDeviceDetails,
        httpFailure(InvalidPairingError, 'Unauthorized'),
      ],
    }),
  )
  .middleware(ClientRequest);
const sessionGroup = HttpApiGroup.make('session')
  .add(
    HttpApiEndpoint.get('readSession', '/session', {
      disableCodecs: true,
      success: readSessionResponseSchema,
    }),
    HttpApiEndpoint.post('issueLiveTicket', '/live/tickets', {
      disableCodecs: true,
      success: issueLiveTicketResponseSchema,
      error: [
        httpFailure(DeviceViewerRequiredError, 'Forbidden'),
        httpFailure(TooManyLiveTicketsError, 'TooManyRequests'),
      ],
    }),
  )
  .middleware(PairedRequest)
  .middleware(ClientRequest);
const pushRegistrationDeviceRequired = httpFailure(
  PushRegistrationDeviceRequiredError,
  'Forbidden',
);
const pushRegistrationGroup = HttpApiGroup.make('pushRegistration')
  .add(
    HttpApiEndpoint.put('setPushRegistration', '/push-registration', {
      disableCodecs: true,
      payload: setPushRegistrationRequestSchema,
      success: setPushRegistrationResponseSchema,
      error: pushRegistrationDeviceRequired,
    }),
    HttpApiEndpoint.delete('clearPushRegistration', '/push-registration', {
      disableCodecs: true,
      success: clearPushRegistrationResponseSchema.pipe(
        HttpApiSchema.asNoContent({ decode: () => undefined }),
        HttpApiSchema.status('NoContent'),
      ),
      error: pushRegistrationDeviceRequired,
    }),
  )
  .middleware(PairedRequest)
  .middleware(ClientRequest);
const updatesGroup = HttpApiGroup.make('serviceUpdates')
  .add(
    HttpApiEndpoint.get('readServiceUpdate', '/service/update', {
      disableCodecs: true,
      success: readServiceUpdateResponseSchema,
    }),
    HttpApiEndpoint.post('startServiceUpdate', '/service/update', {
      disableCodecs: true,
      payload: startServiceUpdateRequestSchema,
      success: startServiceUpdateResponseSchema.pipe(
        HttpApiSchema.status('Accepted'),
      ),
      error: [
        httpFailure(UntrustedDeviceError, 'Forbidden'),
        httpFailure(ServiceNotManagedError, 'Conflict'),
        httpFailure(ServiceUpdateRunningError, 'Conflict'),
        httpFailure(ServiceUpdateNotOfferedError, 'Conflict'),
      ],
    }),
  )
  .middleware(PairedRequest)
  .middleware(ClientRequest);
const reviewGitSettingsGroup = HttpApiGroup.make('reviewGitSettings')
  .add(
    HttpApiEndpoint.get('readReviewGitSettings', '/review-git-settings', {
      disableCodecs: true,
      success: readReviewGitSettingsResponseSchema,
    }),
    HttpApiEndpoint.patch('saveReviewGitSettings', '/review-git-settings', {
      disableCodecs: true,
      payload: saveReviewGitSettingsRequestSchema,
      success: saveReviewGitSettingsResponseSchema,
      error: [
        httpFailure(ReviewGitSettingsTrustRequiredError, 'Forbidden'),
        httpFailure(ReviewGitSettingsNotConfiguredError, 'Conflict'),
      ],
    }),
  )
  .middleware(PairedRequest)
  .middleware(ClientRequest);
const sharingManagementRequired = httpFailure(
  SharingManagementRequiredError,
  'Forbidden',
);
const administrationGroup = HttpApiGroup.make('administration')
  .add(
    HttpApiEndpoint.get('listAccess', '/access', {
      disableCodecs: true,
      success: listAccessResponseSchema,
      error: sharingManagementRequired,
    }),
    HttpApiEndpoint.post('issuePairing', '/pairings', {
      disableCodecs: true,
      payload: issuePairingRequestSchema,
      success: issuePairingResponseSchema,
      error: [
        sharingManagementRequired,
        environmentUnavailable,
        invalidDeviceDetails,
        httpFailure(InvalidPairingAddressError, 'BadRequest'),
      ],
    }),
    HttpApiEndpoint.post('revokeAccess', '/access/revoke', {
      disableCodecs: true,
      payload: revokeAccessRequestSchema,
      success: revokeAccessResponseSchema,
      error: sharingManagementRequired,
    }),
    HttpApiEndpoint.post('setDeviceTrust', '/access/trust', {
      disableCodecs: true,
      payload: setDeviceTrustRequestSchema,
      success: setDeviceTrustResponseSchema,
      error: [
        sharingManagementRequired,
        httpFailure(DeviceNotFoundError, 'NotFound'),
      ],
    }),
    HttpApiEndpoint.post(
      'setManagementPermission',
      '/access/management-permission',
      {
        disableCodecs: true,
        payload: setManagementPermissionRequestSchema,
        success: setManagementPermissionResponseSchema,
        error: [
          sharingManagementRequired,
          httpFailure(DeviceNotFoundError, 'NotFound'),
        ],
      },
    ),
    HttpApiEndpoint.post('setWaysInPermission', '/access/ways-in-permission', {
      disableCodecs: true,
      payload: setWaysInPermissionRequestSchema,
      success: setWaysInPermissionResponseSchema,
      error: [
        sharingManagementRequired,
        httpFailure(DeviceNotFoundError, 'NotFound'),
      ],
    }),
  )
  .middleware(PairedRequest)
  .middleware(ClientRequest);
const waysInPermissionRequired = httpFailure(
  WaysInPermissionRequiredError,
  'Forbidden',
);
const remoteAccessGroup = HttpApiGroup.make('remoteAccess')
  .add(
    HttpApiEndpoint.get('readRemoteAccess', '/remote-access', {
      disableCodecs: true,
      success: readRemoteAccessResponseSchema,
      error: waysInPermissionRequired,
    }),
    HttpApiEndpoint.patch('setRemoteAccess', '/remote-access', {
      disableCodecs: true,
      payload: setRemoteAccessRequestSchema,
      success: setRemoteAccessResponseSchema,
      error: [
        waysInPermissionRequired,
        httpFailure(WaysInChangedError, 'Conflict'),
        httpFailure(RemoteRouteInUseError, 'Conflict'),
        httpFailure(InvalidTailnetHostnameError, 'BadRequest'),
        httpFailure(InvalidTunnelHostnameError, 'BadRequest'),
        httpFailure(MissingTailnetHostnameError, 'BadRequest'),
        httpFailure(MissingTunnelHostnameError, 'BadRequest'),
        httpFailure(NoLocalNetworkError, 'Conflict'),
        httpFailure(UnidentifiedLocalNetworkError, 'Conflict'),
      ],
    }),
  )
  .middleware(PairedRequest)
  .middleware(ClientRequest);
const environmentLabelGroup = HttpApiGroup.make('environmentLabel')
  .add(
    HttpApiEndpoint.put('renameEnvironment', '/environment/name', {
      disableCodecs: true,
      payload: renameEnvironmentRequestSchema,
      success: renameEnvironmentResponseSchema,
    }),
  )
  .add(
    HttpApiEndpoint.put('setEnvironmentIcon', '/environment/icon', {
      disableCodecs: true,
      payload: setEnvironmentIconRequestSchema,
      success: setEnvironmentIconResponseSchema,
    }),
  )
  .middleware(PairedRequest);
const ownerStatusGroup = HttpApiGroup.make('ownerStatus')
  .add(
    HttpApiEndpoint.get('readOwnerStatus', '/status', {
      disableCodecs: true,
      success: readOwnerStatusResponseSchema,
    }),
  )
  .middleware(PairedRequest);

export class PublicAccessApi extends porcelainApi
  .add(publicGroup)
  .prefix('/api') {}
export class BrowserAccessApi extends porcelainApi
  .add(browserGroup)
  .prefix('/api') {}
export class PairingApi extends porcelainApi.add(pairingGroup).prefix('/api') {}
export class SessionApi extends porcelainApi.add(sessionGroup).prefix('/api') {}
export class PushRegistrationApi extends porcelainApi
  .add(pushRegistrationGroup)
  .prefix('/api') {}
export class ServiceUpdatesApi extends porcelainApi
  .add(updatesGroup)
  .prefix('/api') {}
export class RemoteAccessApi extends porcelainApi
  .add(remoteAccessGroup)
  .prefix('/api') {}
export class ReviewGitSettingsApi extends porcelainApi
  .add(reviewGitSettingsGroup)
  .prefix('/api') {}
export class SharingApi extends porcelainApi
  .add(administrationGroup)
  .prefix('/api') {}
export class HostAccessApi extends porcelainApi
  .add(environmentLabelGroup)
  .prefix('/api') {}
export class OwnerAccessApi extends porcelainApi.add(
  administrationGroup,
  remoteAccessGroup,
  ownerStatusGroup,
) {}
export class AccessApi extends porcelainApi
  .add(
    publicGroup,
    browserGroup,
    pairingGroup,
    sessionGroup,
    pushRegistrationGroup,
    updatesGroup,
    remoteAccessGroup,
    reviewGitSettingsGroup,
    administrationGroup,
    environmentLabelGroup,
  )
  .prefix('/api') {}
