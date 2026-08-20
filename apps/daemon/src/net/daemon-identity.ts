import { hostname } from 'node:os'

/**
 * Who this daemon is, so a client never has to be *told* which machine it reached.
 *
 * Environments used to be a user-typed string: you invented "Beelink" when you added
 * the URL, and nothing ever confirmed the window was actually on the Beelink. The
 * daemon announcing its own identity is what lets the app auto-name an environment and
 * label "This device" correctly on every platform.
 *
 * This is the MACHINE, not the display name. A nickname sits on top of it — see the
 * environment identity store, whose `name` defaults to this `host` and which the human
 * can override, because two daemons with their own homes on one machine report the same
 * host and nothing else tells them apart.
 *
 * Rides the existing `daemonInfo` procedure rather than a second identity endpoint so
 * every current client gets the same machine label from the same response.
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
  return trimmed.split('.')[0] ?? trimmed
}

/**
 * This daemon's identity. Args are injectable for tests.
 *
 * `PORCELAIN_DAEMON_HOST` overrides `os.hostname()` when set (marketing shots /
 * hermetic e2e) so published screenshots never leak a personal machine name.
 * Blank/whitespace falls through to the real hostname.
 */
export function daemonIdentity(
  host = process.env.PORCELAIN_DAEMON_HOST?.trim() || hostname(),
  platform = process.platform,
  arch = process.arch,
): DaemonIdentity {
  return { host: shortHostname(host), platform, arch }
}
