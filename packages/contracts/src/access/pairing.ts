import { urlStringSchema } from '../shared/schema.ts';
import { Schema } from 'effect';
import { pairingLinkSchema } from './pairing-link.ts';
import type { Principal } from './principal.ts';
import {
  DEVICE_LABEL_LENGTH,
  DEVICE_PLATFORM_LENGTH,
  PAIRING_ADDRESSES,
  PAIRING_CODE_LENGTH,
  PAIRING_LABELS,
} from '../shared/limits.ts';

export const redeemPairingRequestSchema = Schema.Struct({
  code: Schema.String.check(Schema.isMinLength(1)).check(
    Schema.isMaxLength(PAIRING_CODE_LENGTH),
  ),
  platform: Schema.String.check(Schema.isMinLength(1)).check(
    Schema.isMaxLength(DEVICE_PLATFORM_LENGTH),
  ),
  label: Schema.optional(
    Schema.String.check(Schema.isMinLength(1)).check(
      Schema.isMaxLength(DEVICE_LABEL_LENGTH),
    ),
  ),
});
export const redeemPairingResponseSchema = Schema.Struct({
  device: Schema.Struct({
    id: Schema.String,
    label: Schema.String,
    platform: Schema.String,
    createdAt: Schema.String,
  }),
  credential: Schema.optional(Schema.String),
});

const pairingGrantSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  addresses: Schema.Array(Schema.String),
  createdAt: Schema.String,
  expiresAt: Schema.String,
  trusted: Schema.Boolean,
});
export const deviceRouteSchema = Schema.Literals([
  'loopback',
  'lan',
  'tailnet',
  'tunnel',
]);

const deviceSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  platform: Schema.String,
  createdAt: Schema.String,
  lastSeenAt: Schema.String,
  lastSeenAddress: Schema.optional(Schema.String),
  route: deviceRouteSchema,
  routeInferred: Schema.optional(Schema.Boolean),
  trusted: Schema.Boolean,
  current: Schema.optional(Schema.Boolean),
});

export const listAccessResponseSchema = Schema.Struct({
  grants: Schema.Array(pairingGrantSchema),
  devices: Schema.Array(deviceSchema),
});

export const issuePairingRequestSchema = Schema.Struct({
  labels: Schema.Array(
    Schema.String.check(Schema.isMinLength(1)).check(
      Schema.isMaxLength(DEVICE_LABEL_LENGTH),
    ),
  )
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(PAIRING_LABELS)),
  addresses: Schema.Array(urlStringSchema)
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(PAIRING_ADDRESSES)),
  trusted: Schema.optional(Schema.Boolean),
});
export const issuePairingResponseSchema = Schema.Struct({
  grants: Schema.Array(
    Schema.Struct({
      grant: pairingGrantSchema,
      code: Schema.String,
      link: pairingLinkSchema,
    }),
  ),
});

export const revokeAccessRequestSchema = Schema.Struct({
  id: Schema.String.check(Schema.isMinLength(1)),
});
export const revokeAccessResponseSchema = Schema.Struct({
  revoked: Schema.Boolean,
  kind: Schema.optional(Schema.Literals(['grant', 'device'])),
});

export const setDeviceTrustRequestSchema = Schema.Struct({
  id: Schema.String.check(Schema.isMinLength(1)),
  trusted: Schema.Boolean,
});
export const setDeviceTrustResponseSchema = Schema.Struct({
  id: Schema.String,
  trusted: Schema.Boolean,
});

export const clearBrowserSessionResponseSchema = Schema.Undefined;

type RedeemPairingRequest = typeof redeemPairingRequestSchema.Type;
export type DeviceRoute = typeof deviceRouteSchema.Type;
export type RedeemPairingInput = RedeemPairingRequest & { route: DeviceRoute };
export type RedeemPairingResponse = typeof redeemPairingResponseSchema.Type;
export type ListAccessRequest = { viewer: Principal };
export type ListAccessResponse = typeof listAccessResponseSchema.Type;
export type IssuePairingRequest = typeof issuePairingRequestSchema.Type;
export type IssuePairingResponse = typeof issuePairingResponseSchema.Type;
export type RevokeAccessRequest = typeof revokeAccessRequestSchema.Type;
export type RevokeAccessResponse = typeof revokeAccessResponseSchema.Type;
export type SetDeviceTrustRequest = typeof setDeviceTrustRequestSchema.Type;
export type SetDeviceTrustResponse = typeof setDeviceTrustResponseSchema.Type;
export type ClearBrowserSessionResponse =
  typeof clearBrowserSessionResponseSchema.Type;
