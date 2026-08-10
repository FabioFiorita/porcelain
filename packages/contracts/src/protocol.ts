import { z } from 'zod'

/**
 * The version of the Porcelain wire protocol this build speaks.
 *
 * One literal owned here is what lets a client compare protocols instead of guessing from
 * a build version: app releases move constantly, the protocol only when the wire actually
 * changes. Daemon and every repository-owned client import this same value, so there is
 * never a second opinion about which protocol a process speaks.
 *
 * Today it is only *announced* (`daemonInfo.protocolVersion`). Sending it on requests and
 * enforcing it at the HTTP boundary are separate, later units — announcing first is what
 * makes those safe.
 */
export const PROTOCOL_VERSION = 1

/** Accepts only the exact protocol this build speaks; any other value is a mismatch. */
export const protocolVersionSchema = z.literal(PROTOCOL_VERSION)

export type ProtocolVersion = z.infer<typeof protocolVersionSchema>
