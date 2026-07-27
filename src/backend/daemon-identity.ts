import { hostname } from 'node:os'

/**
 * Who this daemon is, so a client never has to be *told* which machine it reached.
 *
 * Environments used to be a user-typed string: you invented "Beelink" when you added
 * the URL, and nothing ever confirmed the window was actually on the Beelink. The
 * daemon announcing its own identity is what lets the app auto-name an environment,
 * label "This device" correctly on every platform, and show a machine in the top-bar
 * switcher rather than a nickname (plans/environments-v2.md, phase 1).
 *
 * Rides the EXISTING `daemonInfo` procedure rather than a new one: that procedure is
 * already the version-skew probe every client calls, and widening its result is
 * backward compatible (a daemon older than this build simply returns `{ version }`,
 * which clients must treat as "identity unknown", never as unreachable).
 *
 * Nothing here is a secret — a host name, an OS, and a CPU arch. Never widen it to
 * anything that is (paths, users, the token).
 */

export interface DaemonIdentity {
  /** Short host name — `beelink.local` and `beelink.lan` both read as `beelink`. */
  host: string
  /** Node's `process.platform` value, raw — `platformLabel` renders it. */
  platform: string
  arch: string
}

// A bare IPv4 is a legitimate `hostname()` result on some hosts; splitting it on the
// first dot would turn 192.168.1.9 into "192". Recognize it and keep it whole.
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/

/**
 * The display form of a raw host name: the first label, with a trailing DNS domain
 * (`.local`, `.lan`, `.tailnet.ts.net`, …) dropped. Pure — unit-tested.
 *
 * Returns '' for an empty/blank input so callers can fall back rather than render a
 * blank chip; `hostname()` is documented to always return something, but a container
 * with an unset hostname has been observed returning ''.
 */
export function shortHostname(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed === '' || IPV4.test(trimmed)) return trimmed
  return trimmed.split('.')[0]
}

/** This daemon's identity. Args are injectable for tests. */
export function daemonIdentity(
  host = hostname(),
  platform = process.platform,
  arch = process.arch,
): DaemonIdentity {
  return { host: shortHostname(host), platform, arch }
}
