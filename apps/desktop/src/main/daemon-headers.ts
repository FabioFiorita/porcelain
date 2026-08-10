import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'

/**
 * Every request the shell makes to a daemon — pairing, probes, revocation — declares the
 * protocol this build speaks. One helper rather than four spellings: a site that quietly lost
 * the header would look to the daemon like a client too old to talk to, and the failure would
 * show up in only one corner of the switcher. The name and value come from contracts, which
 * own the wire vocabulary the daemon boundary enforces.
 */
export const protocolHeaders: Record<string, string> = {
  [PROTOCOL_VERSION_HEADER]: String(PROTOCOL_VERSION),
}

/** Bearer credential plus the protocol version: the headers on an authenticated daemon call. */
export function daemonHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, ...protocolHeaders }
}
