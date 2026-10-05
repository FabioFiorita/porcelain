import { Schema } from 'effect';
import { TUNNEL_HOSTNAME_LENGTH } from '../shared/limits.ts';

const routeStateSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('off') }),
  Schema.Struct({ kind: Schema.Literal('starting') }),
  Schema.Struct({
    kind: Schema.Literal('on'),
    urls: Schema.Array(Schema.String),
  }),
  Schema.Struct({ kind: Schema.Literal('paused') }),
  Schema.Struct({
    kind: Schema.Literal('failed'),
    reason: Schema.Literals([
      'address-in-use',
      'address-unavailable',
      'unreachable',
      'other-server',
    ]),
  }),
]);

const localNetworkSchema = Schema.Struct({
  interfaceName: Schema.String,
  subnet: Schema.String,
  gateway: Schema.String,
  gatewayHardware: Schema.optional(Schema.String),
});

const routeSchema = Schema.Struct({
  enabled: Schema.Boolean,
  status: routeStateSchema,
});

export const readRemoteAccessResponseSchema = Schema.Struct({
  routes: Schema.Struct({
    lan: routeSchema,
    tailnet: routeSchema,
    cloudflare: routeSchema,
  }),
  lanNetwork: Schema.optional(localNetworkSchema),
  localNetwork: Schema.optional(localNetworkSchema),
  tailnetHostname: Schema.optional(Schema.String),
  tailnetTarget: Schema.optional(Schema.String),
  cloudflareHostname: Schema.optional(Schema.String),
  serviceUrl: Schema.String,
});

export const setRemoteAccessRequestSchema = Schema.Struct({
  lan: Schema.optional(Schema.Boolean),
  tailnet: Schema.optional(Schema.Boolean),
  tailnetHostname: Schema.optional(
    Schema.String.check(Schema.isMinLength(1)).check(
      Schema.isMaxLength(TUNNEL_HOSTNAME_LENGTH),
    ),
  ),
  cloudflare: Schema.optional(Schema.Boolean),
  cloudflareHostname: Schema.optional(
    Schema.String.check(Schema.isMinLength(1)).check(
      Schema.isMaxLength(TUNNEL_HOSTNAME_LENGTH),
    ),
  ),
}).check(
  Schema.makeFilter(
    (change: Readonly<Record<string, unknown>>) =>
      Object.keys(change).length > 0,
  ),
);

export const setRemoteAccessResponseSchema = readRemoteAccessResponseSchema;

export type ReadRemoteAccessResponse =
  typeof readRemoteAccessResponseSchema.Type;
export type SetRemoteAccessRequest = typeof setRemoteAccessRequestSchema.Type;
export type SetRemoteAccessResponse = typeof setRemoteAccessResponseSchema.Type;
