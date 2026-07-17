/**
 * The sentinel a daemon older than 0.30 gets tagged with: it has no `daemonInfo`
 * procedure, so the client's query 404s and we know only that it's older, not which
 * version. `computeVersionSkew` treats it as definitely-older.
 */
export const PRE_030 = 'pre-0.30'

export interface VersionSkew {
  /** The daemon's reported build version (or the `pre-0.30` sentinel). */
  daemonVersion: string
  /** This renderer build's version. */
  appVersion: string
  /** True when the daemon is behind the app (restart the daemon); false when ahead (update the app). */
  daemonIsOlder: boolean
  /** One-line human message, identical in the Remote chip tooltip and the toast. */
  message: string
}

/**
 * Compare this app's build version against the daemon's. Returns null when they
 * match (the trivial local case, and a fresh browser client served by the same
 * daemon dist), or a `VersionSkew` describing any mismatch — the daemon can be
 * older (the motivating incident) OR newer (a stale app), phrased for each.
 *
 * Pure and total: an unparseable daemon version (only our `pre-0.30` sentinel in
 * practice) is treated as older, since that's the one case that produces it.
 */
export function computeVersionSkew(appVersion: string, daemonVersion: string): VersionSkew | null {
  if (daemonVersion === appVersion) return null
  const daemonIsOlder = isDaemonOlder(appVersion, daemonVersion)
  const fix = daemonIsOlder
    ? 'restart the remote daemon to update'
    : 'update this app to match the daemon'
  const message = `Daemon ${label(daemonVersion)} · app ${label(appVersion)} — ${fix}`
  return { daemonVersion, appVersion, daemonIsOlder, message }
}

/** `v1.2.3` for a semver-shaped string; the raw value (e.g. `pre-0.30`) otherwise. */
function label(version: string): string {
  return /^\d/.test(version) ? `v${version}` : version
}

function isDaemonOlder(appVersion: string, daemonVersion: string): boolean {
  if (daemonVersion === PRE_030) return true
  const cmp = compareSemver(daemonVersion, appVersion)
  // Indeterminate (unparseable on either side) → assume the daemon is older; the
  // only non-semver value we ever compare is the pre-0.30 sentinel, older by design.
  return cmp === null ? true : cmp < 0
}

/** Negative if a < b, positive if a > b, 0 if equal by major.minor.patch; null if either is unparseable. */
function compareSemver(a: string, b: string): number | null {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (pa === null || pb === null) return null
  for (let i = 0; i < 3; i++) {
    const av = pa[i] ?? 0
    const bv = pb[i] ?? 0
    if (av !== bv) return av - bv
  }
  return 0
}

function parseSemver(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}
