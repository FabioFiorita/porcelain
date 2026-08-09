import { z } from 'zod'

/** The daemon's public identity, without host-only or credential data. */
export const daemonInfoInputSchema = z.void()
export const daemonInfoOutputSchema = z
  .object({
    version: z.string(),
    host: z.string(),
    platform: z.string(),
    arch: z.string(),
  })
  .strict()

export type DaemonInfoInput = z.infer<typeof daemonInfoInputSchema>
export type DaemonInfoOutput = z.infer<typeof daemonInfoOutputSchema>

export const pairingGrantSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    createdAt: z.string(),
    expiresAt: z.string(),
  })
  .strict()

export const authorizedClientSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    createdAt: z.string(),
  })
  .strict()

export type PairingGrant = z.infer<typeof pairingGrantSchema>
export type AuthorizedClient = z.infer<typeof authorizedClientSchema>

/** The administrator's current pairing grants and authorized clients. */
export const accessStatusInputSchema = z.void()
export const accessStatusOutputSchema = z
  .object({
    pairings: z.array(pairingGrantSchema),
    clients: z.array(authorizedClientSchema),
    connected: z.number(),
    adminTokenPath: z.string(),
  })
  .strict()

export type AccessStatusInput = z.infer<typeof accessStatusInputSchema>
export type AccessStatusOutput = z.infer<typeof accessStatusOutputSchema>

/** Inputs and output for creating a one-time pairing link. */
export const issuePairingLinkInputSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    baseUrl: z.string().url(),
  })
  .strict()
export const issuePairingLinkOutputSchema = pairingGrantSchema
  .extend({
    credential: z.string(),
    url: z.string().url(),
  })
  .strict()

export type IssuePairingLinkInput = z.infer<typeof issuePairingLinkInputSchema>
export type IssuePairingLinkOutput = z.infer<typeof issuePairingLinkOutputSchema>

/** Pairing/client revocations return no payload when the request is accepted. */
export const revokePairingLinkInputSchema = z.string()
export const revokePairingLinkOutputSchema = z.void()
export type RevokePairingLinkInput = z.infer<typeof revokePairingLinkInputSchema>
export type RevokePairingLinkOutput = z.infer<typeof revokePairingLinkOutputSchema>

export const revokeAuthorizedClientInputSchema = z.string()
export const revokeAuthorizedClientOutputSchema = z.void()
export type RevokeAuthorizedClientInput = z.infer<typeof revokeAuthorizedClientInputSchema>
export type RevokeAuthorizedClientOutput = z.infer<typeof revokeAuthorizedClientOutputSchema>

export const revokeCurrentClientInputSchema = z.void()
export const revokeCurrentClientOutputSchema = z.void()
export type RevokeCurrentClientInput = z.infer<typeof revokeCurrentClientInputSchema>
export type RevokeCurrentClientOutput = z.infer<typeof revokeCurrentClientOutputSchema>

/** Status returned by the optional Tailnet listener. */
export const tailnetStatusInputSchema = z.void()
export const tailnetStatusOutputSchema = z
  .object({
    enabled: z.boolean(),
    url: z.string().url().nullable(),
    error: z.literal('in-use').nullable(),
    envForced: z.boolean(),
    port: z.number(),
  })
  .strict()
export type TailnetStatusInput = z.infer<typeof tailnetStatusInputSchema>
export type TailnetStatusOutput = z.infer<typeof tailnetStatusOutputSchema>

export const setTailnetBindInputSchema = z.boolean()
export const setTailnetBindOutputSchema = tailnetStatusOutputSchema
export type SetTailnetBindInput = z.infer<typeof setTailnetBindInputSchema>
export type SetTailnetBindOutput = z.infer<typeof setTailnetBindOutputSchema>

/** Status returned by the optional LAN listeners. */
export const lanStatusInputSchema = z.void()
export const lanStatusOutputSchema = z
  .object({
    enabled: z.boolean(),
    url: z.string().url().nullable(),
    numericUrl: z.string().url().nullable(),
    error: z.literal('in-use').nullable(),
    envForced: z.boolean(),
    port: z.number(),
  })
  .strict()
export type LanStatusInput = z.infer<typeof lanStatusInputSchema>
export type LanStatusOutput = z.infer<typeof lanStatusOutputSchema>

export const setLanBindInputSchema = z.boolean()
export const setLanBindOutputSchema = lanStatusOutputSchema
export type SetLanBindInput = z.infer<typeof setLanBindInputSchema>
export type SetLanBindOutput = z.infer<typeof setLanBindOutputSchema>

/** Status returned by Tailscale Funnel, including ownership and availability. */
export const funnelStatusInputSchema = z.void()
export const funnelStatusOutputSchema = z
  .object({
    enabled: z.boolean(),
    url: z.string().url().nullable(),
    managed: z.boolean(),
    error: z.union([z.literal('unavailable'), z.literal('conflict')]).nullable(),
    envForced: z.boolean(),
  })
  .strict()
export type FunnelStatusInput = z.infer<typeof funnelStatusInputSchema>
export type FunnelStatusOutput = z.infer<typeof funnelStatusOutputSchema>

export const setFunnelBindInputSchema = z.boolean()
export const setFunnelBindOutputSchema = funnelStatusOutputSchema
export type SetFunnelBindInput = z.infer<typeof setFunnelBindInputSchema>
export type SetFunnelBindOutput = z.infer<typeof setFunnelBindOutputSchema>

/** Representative contract-valid data used by Remote boundary tests and client mocks. */
export const remoteContractFixtures = {
  daemonInfo: {
    input: undefined,
    output: { version: '0.52.1', host: 'beelink', platform: 'linux', arch: 'x64' },
  },
  accessStatus: {
    input: undefined,
    output: { pairings: [], clients: [], connected: 0, adminTokenPath: '~/.porcelain/admin-token' },
  },
  issuePairingLink: {
    input: { label: 'Fabio laptop', baseUrl: 'https://porcelain.example' },
    output: {
      id: 'pairing-id',
      label: 'Fabio laptop',
      createdAt: '2026-08-09T12:00:00.000Z',
      expiresAt: '2026-08-09T12:15:00.000Z',
      credential: 'pc_pair_pairing-id_secret',
      url: 'https://porcelain.example/pair#token=pc_pair_pairing-id_secret',
    },
  },
  revokePairingLink: { input: 'pairing-id', output: undefined },
  revokeAuthorizedClient: { input: 'client-id', output: undefined },
  revokeCurrentClient: { input: undefined, output: undefined },
  tailnetStatus: {
    input: undefined,
    output: {
      enabled: true,
      url: 'http://beelink.tailnet.ts.net:43118',
      error: null,
      envForced: false,
      port: 43118,
    },
  },
  setTailnetBind: {
    input: true,
    output: {
      enabled: true,
      url: 'http://beelink.tailnet.ts.net:43118',
      error: null,
      envForced: false,
      port: 43118,
    },
  },
  lanStatus: {
    input: undefined,
    output: {
      enabled: true,
      url: 'http://beelink.local:43118',
      numericUrl: 'http://192.168.1.10:43118',
      error: null,
      envForced: false,
      port: 43118,
    },
  },
  setLanBind: {
    input: true,
    output: {
      enabled: true,
      url: 'http://beelink.local:43118',
      numericUrl: 'http://192.168.1.10:43118',
      error: null,
      envForced: false,
      port: 43118,
    },
  },
  funnelStatus: {
    input: undefined,
    output: { enabled: false, url: null, managed: false, error: 'unavailable', envForced: false },
  },
  setFunnelBind: {
    input: false,
    output: { enabled: false, url: null, managed: false, error: 'unavailable', envForced: false },
  },
} as const
