/**
 * "The daemon on the other end is running an older release than this client."
 *
 * Distinct from the protocol gate: a daemon whose `PROTOCOL_VERSION` no longer matches is
 * refused outright and the session reports `update-required` (remote-session.ts). This
 * module covers the softer window that gate leaves open — the protocol still matches, every
 * query works, but the remote host is a release or three behind and nothing says so.
 *
 * The comparison signal is deliberately LOCAL: this client's own baked-in version
 * (`__PORCELAIN_VERSION__`) against `daemonInfo.version`. No registry lookup, so it works
 * offline, adds no daemon procedure, and cannot nag because npm was slow. The blind spot it
 * accepts: a browser tab served BY the outdated daemon downloads that daemon's own bundle,
 * so both versions match and nothing is shown. The case Porcelain actually has — an
 * auto-updating Electron client (or a Hub served from another origin) pointed at a
 * long-lived remote daemon — is exactly where the two versions diverge.
 */

/**
 * Numeric `x.y.z` order. A prerelease or build suffix is dropped before the split, so
 * `0.55.0-rc.1` ranks with `0.55.0` rather than becoming a fourth segment that outranks it —
 * this decides whether to nag, and "the release candidate of the version you already have"
 * is not a reason to nag. Any remaining non-numeric segment counts as 0.
 */
export function compareVersions(left: string, right: string): number {
  const parts = (value: string): number[] =>
    (/^v?([^-+]*)/.exec(value)?.[1] ?? '').split('.').map((segment) => {
      const digits = /^\d+/.exec(segment)
      return digits === null ? 0 : Number(digits[0])
    })
  const a = parts(left)
  const b = parts(right)
  const length = Math.max(a.length, b.length)
  for (let index = 0; index < length; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0)
    if (diff !== 0) return diff < 0 ? -1 : 1
  }
  return 0
}

/**
 * A hostname the page was served from that means "the machine in front of me". Used for the
 * browser client, which has no shell bridge to ask (`shellTrpc.localDaemon.isLocal`).
 */
export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')
}

export interface DaemonUpdatePromptInput {
  /** Version baked into this client build; null before it is known. */
  clientVersion: string | null
  /** `daemonInfo.version` for the daemon THIS window is bound to; null until it answers. */
  daemonVersion: string | null
  /** `daemonInfo.host`; the dismissal key, so a second remote is prompted on its own. */
  daemonHost: string | null
  /** False only when this window is provably talking to the daemon on this machine. */
  isRemote: boolean
  /** Persisted `host -> version last dismissed`. */
  dismissed: Readonly<Record<string, string>>
}

/**
 * Show the prompt only when every part is known, the daemon is remote, its version is
 * strictly older, and this exact daemon version has not already been waved off. Dismissal
 * is per host AND version, so the next lagging release asks again instead of staying silent
 * forever.
 */
export function shouldPromptDaemonUpdate(input: DaemonUpdatePromptInput): boolean {
  const { clientVersion, daemonVersion, daemonHost, isRemote, dismissed } = input
  if (!isRemote) return false
  if (clientVersion === null || daemonVersion === null || daemonHost === null) return false
  if (compareVersions(daemonVersion, clientVersion) >= 0) return false
  return dismissed[daemonHost] !== daemonVersion
}

/**
 * The documented restart. The always-on unit's `ExecStart` runs
 * `npx --yes --prefer-online @fabiofiorita/porcelain@latest serve …`, so restarting the service IS
 * the upgrade — there is no separate install step to paste (docs/remote-access.md).
 */
export const DAEMON_UPDATE_SYSTEMD_COMMAND = 'systemctl --user restart porcelain.service'

/** For a daemon started by hand in a shell rather than supervised by systemd. */
export const DAEMON_UPDATE_FOREGROUND_COMMAND = 'npx @fabiofiorita/porcelain@latest serve'

export const DAEMON_UPDATE_DOCS_URL =
  'https://github.com/FabioFiorita/porcelain/blob/main/docs/remote-access.md'
