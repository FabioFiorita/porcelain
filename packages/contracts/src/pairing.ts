import { z } from 'zod';

export const redeemPairingSchema = z.object({
  code: z.string().min(1).max(200),
  platform: z.string().min(1).max(120),
  label: z.string().min(1).max(80).optional(),
});

export const redeemedPairingSchema = z.object({
  device: z.object({
    id: z.string(),
    label: z.string(),
    platform: z.string(),
    createdAt: z.string(),
  }),
  credential: z.string().optional(),
});

export const pairingGrantSchema = z.object({
  id: z.string(),
  label: z.string(),
  addresses: z.array(z.string()),
  createdAt: z.string(),
  expiresAt: z.string(),
});

export const deviceSchema = z.object({
  id: z.string(),
  label: z.string(),
  platform: z.string(),
  createdAt: z.string(),
  lastSeenAt: z.string(),
  lastSeenAddress: z.string().nullable(),
});

export const accessListingSchema = z.object({
  grants: z.array(pairingGrantSchema),
  devices: z.array(deviceSchema),
});

export const issueGrantsSchema = z.object({
  labels: z.array(z.string().min(1).max(80)).min(1).max(20),
  addresses: z.array(z.string().url()).min(1).max(10),
});

export const issuedGrantsSchema = z.object({
  grants: z.array(
    pairingGrantSchema.extend({ code: z.string(), link: z.string() }),
  ),
});

export const revokeAccessSchema = z.object({ id: z.string().min(1) });
export const revokedAccessSchema = z.object({
  revoked: z.boolean(),
  kind: z.enum(['grant', 'device']).nullable(),
});

export type RedeemedPairingResponse = z.infer<typeof redeemedPairingSchema>;
export type AccessListingResponse = z.infer<typeof accessListingSchema>;
