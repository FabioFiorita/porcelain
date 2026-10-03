import { mcpPayloadSchema, mcpAcceptedResponseSchema } from './mcp-http.ts';
import {
  liveUpdatesQuerySchema,
  liveUpgradeResponseSchema,
} from './live-updates.ts';
import { defineEndpoint } from '../shared/endpoint.ts';
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

export const clearBrowserSessionEndpoint = defineEndpoint({
  method: 'DELETE',
  path: '/session',
  schema: {
    response: { 204: clearBrowserSessionResponseSchema },
  },
  errors: [],
});

export const issueLiveTicketEndpoint = defineEndpoint({
  method: 'POST',
  path: '/live/tickets',
  schema: {
    response: { 200: issueLiveTicketResponseSchema },
  },
  errors: [],
});

export const issuePairingEndpoint = defineEndpoint({
  method: 'POST',
  path: '/pairings',
  schema: {
    body: issuePairingRequestSchema,
    response: { 200: issuePairingResponseSchema },
  },
  errors: [],
});

export const listAccessEndpoint = defineEndpoint({
  method: 'GET',
  path: '/access',
  schema: {
    response: { 200: listAccessResponseSchema },
  },
  errors: [],
});

export const readEnvironmentEndpoint = defineEndpoint({
  method: 'GET',
  path: '/environment',
  schema: {
    response: { 200: readEnvironmentResponseSchema },
  },
  errors: [],
});

export const readHealthEndpoint = defineEndpoint({
  method: 'GET',
  path: '/health',
  errorResponses: false,
  schema: {
    response: { 200: readHealthResponseSchema },
  },
  errors: [],
});

export const readOwnerStatusEndpoint = defineEndpoint({
  prefix: '',
  method: 'GET',
  path: '/status',
  schema: {
    response: { 200: readOwnerStatusResponseSchema },
  },
  errors: [],
});

export const readRemoteAccessEndpoint = defineEndpoint({
  method: 'GET',
  path: '/remote-access',
  schema: {
    response: { 200: readRemoteAccessResponseSchema },
  },
  errors: [],
});

export const readServiceUpdateEndpoint = defineEndpoint({
  method: 'GET',
  path: '/service/update',
  schema: {
    response: { 200: readServiceUpdateResponseSchema },
  },
  errors: [],
});

export const readSessionEndpoint = defineEndpoint({
  method: 'GET',
  path: '/session',
  schema: {
    response: { 200: readSessionResponseSchema },
  },
  errors: [],
});

export const redeemPairingEndpoint = defineEndpoint({
  method: 'POST',
  path: '/pair',
  schema: {
    body: redeemPairingRequestSchema,
    response: { 200: redeemPairingResponseSchema },
  },
  errors: [],
});

export const renameEnvironmentEndpoint = defineEndpoint({
  method: 'PUT',
  path: '/environment/name',
  schema: {
    body: renameEnvironmentRequestSchema,
    response: { 200: renameEnvironmentResponseSchema },
  },
  errors: [],
});

export const revokeAccessEndpoint = defineEndpoint({
  method: 'POST',
  path: '/access/revoke',
  schema: {
    body: revokeAccessRequestSchema,
    response: { 200: revokeAccessResponseSchema },
  },
  errors: [],
});

export const setDeviceTrustEndpoint = defineEndpoint({
  method: 'POST',
  path: '/access/trust',
  schema: {
    body: setDeviceTrustRequestSchema,
    response: { 200: setDeviceTrustResponseSchema },
  },
  errors: [],
});

export const setRemoteAccessEndpoint = defineEndpoint({
  method: 'PATCH',
  path: '/remote-access',
  schema: {
    body: setRemoteAccessRequestSchema,
    response: { 200: setRemoteAccessResponseSchema },
  },
  errors: [],
});

export const startServiceUpdateEndpoint = defineEndpoint({
  method: 'POST',
  path: '/service/update',
  schema: {
    body: startServiceUpdateRequestSchema,
    response: { 202: startServiceUpdateResponseSchema },
  },
  errors: [],
});

export const liveUpdatesEndpoint = defineEndpoint({
  method: 'GET',
  path: '/live',
  schema: {
    querystring: liveUpdatesQuerySchema,
    response: { 101: liveUpgradeResponseSchema },
  },
  errors: [],
});

export const reviewMcpEndpoint = defineEndpoint({
  method: 'POST',
  path: '/mcp',
  prefix: '',
  schema: {
    body: mcpPayloadSchema,
    response: { 200: mcpPayloadSchema, 202: mcpAcceptedResponseSchema },
  },
  errors: [],
});
