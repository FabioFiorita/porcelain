import { z } from 'zod';
import { TUNNEL_HOSTNAME_LENGTH } from '../shared/limits.ts';

const routeStateSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('off') }),
  z.object({ kind: z.literal('starting') }),
  z.object({ kind: z.literal('on'), urls: z.array(z.string()) }),
  z.object({ kind: z.literal('paused') }),
  z.object({
    kind: z.literal('failed'),
    reason: z.enum([
      'no-address',
      'address-in-use',
      'address-unavailable',
      'unreachable',
      'other-server',
    ]),
  }),
]);

const localNetworkSchema = z.object({
  interfaceName: z.string(),
  subnet: z.string(),
});

const routeSchema = z.object({
  enabled: z.boolean(),
  status: routeStateSchema,
});

export const readRemoteAccessResponseSchema = z.object({
  routes: z.object({
    lan: routeSchema,
    tailnet: routeSchema,
    cloudflare: routeSchema,
  }),
  lanNetwork: localNetworkSchema.optional(),
  localNetwork: localNetworkSchema.optional(),
  cloudflareHostname: z.string().optional(),
  serviceUrl: z.string(),
});

export const setRemoteAccessRequestSchema = z
  .strictObject({
    lan: z.boolean().optional(),
    tailnet: z.boolean().optional(),
    cloudflare: z.boolean().optional(),
    cloudflareHostname: z
      .string()
      .min(1)
      .max(TUNNEL_HOSTNAME_LENGTH)
      .optional(),
  })
  .refine((change) => Object.keys(change).length > 0);

export const setRemoteAccessResponseSchema = readRemoteAccessResponseSchema;

export type ReadRemoteAccessResponse = z.output<
  typeof readRemoteAccessResponseSchema
>;
export type SetRemoteAccessRequest = z.output<
  typeof setRemoteAccessRequestSchema
>;
export type SetRemoteAccessResponse = z.output<
  typeof setRemoteAccessResponseSchema
>;
