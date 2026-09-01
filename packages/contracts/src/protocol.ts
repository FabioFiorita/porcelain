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
export const PROTOCOL_VERSION = 2

/**
 * The request header every repository-owned client sends its protocol version on.
 *
 * The name lives here for the same reason the version does: contracts own the wire
 * vocabulary, so a client and the daemon boundary that enforces it can never disagree
 * about the spelling. Lowercase because that is how HTTP/2 and `fetch` normalize it.
 *
 * It is a header, never a query parameter: the version describes the request envelope,
 * not the procedure's input, and must be readable before any body is parsed.
 */
export const PROTOCOL_VERSION_HEADER = 'x-porcelain-protocol-version'

/** Accepts only the exact protocol this build speaks; any other value is a mismatch. */
export const protocolVersionSchema = z.literal(PROTOCOL_VERSION)

export type ProtocolVersion = z.infer<typeof protocolVersionSchema>
