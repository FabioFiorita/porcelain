import { z } from 'zod';

export const redeemPairingRequestSchema = z.strictObject({
  code: z.string().min(1).max(200),
  platform: z.string().min(1).max(120),
  label: z.string().min(1).max(80).optional(),
});
export const redeemPairingResponseSchema = z.object({
  device: z.object({
    id: z.string(),
    label: z.string(),
    platform: z.string(),
    createdAt: z.string(),
  }),
  credential: z.string().optional(),
});

const pairingGrantSchema = z.object({
  id: z.string(),
  label: z.string(),
  addresses: z.array(z.string()),
  createdAt: z.string(),
  expiresAt: z.string(),
});
const deviceSchema = z.object({
  id: z.string(),
  label: z.string(),
  platform: z.string(),
  createdAt: z.string(),
  lastSeenAt: z.string(),
  lastSeenAddress: z.string().optional(),
});

export const listAccessResponseSchema = z.object({
  grants: z.array(pairingGrantSchema),
  devices: z.array(deviceSchema),
});

export const issuePairingRequestSchema = z.strictObject({
  labels: z.array(z.string().min(1).max(80)).min(1).max(20),
  addresses: z.array(z.url()).min(1).max(10),
});
export const issuePairingResponseSchema = z.object({
  grants: z.array(
    z.object({ grant: pairingGrantSchema, code: z.string(), link: z.string() }),
  ),
});

export const revokeAccessRequestSchema = z.strictObject({
  id: z.string().min(1),
});
export const revokeAccessResponseSchema = z.object({
  revoked: z.boolean(),
  kind: z.enum(['grant', 'device']).optional(),
});

export const clearBrowserSessionResponseSchema = z.undefined();

export type RedeemPairingRequest = z.output<typeof redeemPairingRequestSchema>;
export type RedeemPairingResponse = z.output<
  typeof redeemPairingResponseSchema
>;
export type ListAccessResponse = z.output<typeof listAccessResponseSchema>;
export type IssuePairingRequest = z.output<typeof issuePairingRequestSchema>;
export type IssuePairingResponse = z.output<typeof issuePairingResponseSchema>;
export type RevokeAccessRequest = z.output<typeof revokeAccessRequestSchema>;
export type RevokeAccessResponse = z.output<typeof revokeAccessResponseSchema>;
export type ClearBrowserSessionResponse = z.output<
  typeof clearBrowserSessionResponseSchema
>;
