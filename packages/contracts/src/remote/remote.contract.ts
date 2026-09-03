import { z } from 'zod'
import { PROTOCOL_VERSION, protocolVersionSchema } from '../protocol'

/**
 * The daemon's public identity, without host-only or credential data.
 *
 * `protocolVersion` is the wire protocol, not the build: `version` moves every release,
 * `protocolVersion` only when the wire changes, so a client compares the former for display
 * and the latter for compatibility.
 */
export const daemonInfoInputSchema = z.void()
export const daemonInfoOutputSchema = z
  .object({
    version: z.string(),
    protocolVersion: protocolVersionSchema,
    host: z.string(),
    platform: z.string(),
    arch: z.string(),
  })
  .strict()

export type DaemonInfoInput = z.infer<typeof daemonInfoInputSchema>
export type DaemonInfoOutput = z.infer<typeof daemonInfoOutputSchema>

/**
 * On-demand npm lookup for the published package, plus whether this process can
 * restart itself through the always-on systemd unit. `latestVersion` is null when
 * the registry cannot be reached — a failed check is not a reason to hide the
 * restart, which is the whole upgrade for a unit that re-resolves `@latest`.
 */
export const checkDaemonUpdateInputSchema = z.void()
export const checkDaemonUpdateOutputSchema = z
  .object({
    currentVersion: z.string().min(1),
    latestVersion: z.string().min(1).nullable(),
    restartable: z.boolean(),
  })
  .strict()
export type CheckDaemonUpdateInput = z.infer<typeof checkDaemonUpdateInputSchema>
export type CheckDaemonUpdateOutput = z.infer<typeof checkDaemonUpdateOutputSchema>

/** Restart the always-on unit. Development daemons and foreground processes refuse. */
export const restartDaemonInputSchema = z.void()
export const restartDaemonOutputSchema = z.void()
export type RestartDaemonInput = z.infer<typeof restartDaemonInputSchema>
export type RestartDaemonOutput = z.infer<typeof restartDaemonOutputSchema>

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

/** Status returned by the Cloudflare Tunnel in front of loopback. */
export const cloudflareStatusInputSchema = z.void()
export const cloudflareStatusOutputSchema = z
  .object({
    enabled: z.boolean(),
    url: z.string().url().nullable(),
    /** Public origin owned by an externally managed Cloudflare Tunnel. */
    customUrl: z.string().url().nullable(),
    managed: z.boolean(),
    error: z.union([z.literal('unavailable'), z.literal('conflict')]).nullable(),
    envForced: z.boolean(),
  })
  .strict()
export type CloudflareStatusInput = z.infer<typeof cloudflareStatusInputSchema>
export type CloudflareStatusOutput = z.infer<typeof cloudflareStatusOutputSchema>

export const setCloudflareBindInputSchema = z.boolean()
export const setCloudflareBindOutputSchema = cloudflareStatusOutputSchema
export type SetCloudflareBindInput = z.infer<typeof setCloudflareBindInputSchema>
export type SetCloudflareBindOutput = z.infer<typeof setCloudflareBindOutputSchema>

const customCloudflareHostnameSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => (/^https:\/\//i.test(value) ? value : `https://${value}`))
  .pipe(z.string().url())
  .refine((value) => {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      url.pathname === '/' &&
      url.search === '' &&
      url.hash === ''
    )
  }, 'Enter a bare HTTPS hostname')

export const setCloudflareHostnameInputSchema = customCloudflareHostnameSchema.nullable()
export const setCloudflareHostnameOutputSchema = cloudflareStatusOutputSchema
export type SetCloudflareHostnameInput = z.infer<typeof setCloudflareHostnameInputSchema>
export type SetCloudflareHostnameOutput = z.infer<typeof setCloudflareHostnameOutputSchema>

/** Representative contract-valid data used by Remote boundary tests and client mocks. */
export const remoteContractFixtures = {
  daemonInfo: {
    input: undefined,
    output: {
      version: '0.52.1',
      protocolVersion: PROTOCOL_VERSION,
      host: 'workstation',
      platform: 'linux',
      arch: 'x64',
    },
  },
  checkDaemonUpdate: {
    input: undefined,
    output: { currentVersion: '0.52.1', latestVersion: '0.53.0', restartable: true },
  },
  restartDaemon: { input: undefined, output: undefined },
  accessStatus: {
    input: undefined,
    output: { pairings: [], clients: [], connected: 0, adminTokenPath: '~/.porcelain/admin-token' },
  },
  issuePairingLink: {
    input: { label: 'Example laptop', baseUrl: 'https://porcelain.example' },
    output: {
      id: 'pairing-id',
      label: 'Example laptop',
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
      url: 'http://workstation.example:43118',
      error: null,
      envForced: false,
      port: 43118,
    },
  },
  setTailnetBind: {
    input: true,
    output: {
      enabled: true,
      url: 'http://workstation.example:43118',
      error: null,
      envForced: false,
      port: 43118,
    },
  },
  lanStatus: {
    input: undefined,
    output: {
      enabled: true,
      url: 'http://workstation.local:43118',
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
      url: 'http://workstation.local:43118',
      numericUrl: 'http://192.168.1.10:43118',
      error: null,
      envForced: false,
      port: 43118,
    },
  },
  cloudflareStatus: {
    input: undefined,
    output: {
      enabled: false,
      url: null,
      customUrl: null,
      managed: false,
      error: 'unavailable',
      envForced: false,
    },
  },
  setCloudflareBind: {
    input: false,
    output: {
      enabled: false,
      url: null,
      customUrl: null,
      managed: false,
      error: 'unavailable',
      envForced: false,
    },
  },
  setCloudflareHostname: {
    input: 'https://porcelain.example.com',
    output: {
      enabled: false,
      url: null,
      customUrl: 'https://porcelain.example.com',
      managed: false,
      error: null,
      envForced: false,
    },
  },
} as const
