import { environmentUnavailable } from '../shared/environment-failure.ts';
import {
  DeviceNotFoundError,
  DeviceViewerRequiredError,
  InvalidDeviceDetailsError,
  InvalidPairingAddressError,
  InvalidPairingError,
  InvalidTailnetHostnameError,
  InvalidTunnelHostnameError,
  MissingTailnetHostnameError,
  MissingTunnelHostnameError,
  NoLocalNetworkError,
  ServiceNotManagedError,
  ServiceUpdateNotOfferedError,
  ServiceUpdateRunningError,
  TooManyLiveTicketsError,
  UnidentifiedLocalNetworkError,
  UntrustedDeviceError,
} from '@porcelain/access/errors';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/http-api';
import { porcelainApi } from '../shared/http-api.ts';
import { ClientRequest, PairedRequest } from '../shared/http-caller.ts';
import { httpFailure } from '../shared/http-failure.ts';
import {
  readEnvironmentResponseSchema,
  renameEnvironmentRequestSchema,
  renameEnvironmentResponseSchema,
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
} from './pairing.ts';
import { readSessionResponseSchema } from './principal.ts';
import {
  readRemoteAccessResponseSchema,
  setRemoteAccessRequestSchema,
  setRemoteAccessResponseSchema,
} from './remote-access.ts';
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
const administrationGroup = HttpApiGroup.make('administration')
  .add(
    HttpApiEndpoint.get('listAccess', '/access', {
      disableCodecs: true,
      success: listAccessResponseSchema,
    }),
    HttpApiEndpoint.post('issuePairing', '/pairings', {
      disableCodecs: true,
      payload: issuePairingRequestSchema,
      success: issuePairingResponseSchema,
      error: [
        environmentUnavailable,
        invalidDeviceDetails,
        httpFailure(InvalidPairingAddressError, 'BadRequest'),
      ],
    }),
    HttpApiEndpoint.post('revokeAccess', '/access/revoke', {
      disableCodecs: true,
      payload: revokeAccessRequestSchema,
      success: revokeAccessResponseSchema,
    }),
    HttpApiEndpoint.post('setDeviceTrust', '/access/trust', {
      disableCodecs: true,
      payload: setDeviceTrustRequestSchema,
      success: setDeviceTrustResponseSchema,
      error: httpFailure(DeviceNotFoundError, 'NotFound'),
    }),
    HttpApiEndpoint.get('readRemoteAccess', '/remote-access', {
      disableCodecs: true,
      success: readRemoteAccessResponseSchema,
    }),
    HttpApiEndpoint.patch('setRemoteAccess', '/remote-access', {
      disableCodecs: true,
      payload: setRemoteAccessRequestSchema,
      success: setRemoteAccessResponseSchema,
      error: [
        httpFailure(InvalidTailnetHostnameError, 'BadRequest'),
        httpFailure(InvalidTunnelHostnameError, 'BadRequest'),
        httpFailure(MissingTailnetHostnameError, 'BadRequest'),
        httpFailure(MissingTunnelHostnameError, 'BadRequest'),
        httpFailure(NoLocalNetworkError, 'Conflict'),
        httpFailure(UnidentifiedLocalNetworkError, 'Conflict'),
      ],
    }),
  )
  .middleware(PairedRequest);
const environmentNameGroup = HttpApiGroup.make('environmentName')
  .add(
    HttpApiEndpoint.put('renameEnvironment', '/environment/name', {
      disableCodecs: true,
      payload: renameEnvironmentRequestSchema,
      success: renameEnvironmentResponseSchema,
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
export class ServiceUpdatesApi extends porcelainApi
  .add(updatesGroup)
  .prefix('/api') {}
export class HostAccessApi extends porcelainApi
  .add(administrationGroup, environmentNameGroup)
  .prefix('/api') {}
export class OwnerAccessApi extends porcelainApi.add(
  administrationGroup,
  ownerStatusGroup,
) {}
export class AccessApi extends porcelainApi
  .add(
    publicGroup,
    browserGroup,
    pairingGroup,
    sessionGroup,
    updatesGroup,
    administrationGroup,
    environmentNameGroup,
  )
  .prefix('/api') {}
