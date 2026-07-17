import { appVersion } from '@renderer/lib/app-version'
import { trpc } from '@renderer/lib/trpc'
import { computeVersionSkew, PRE_030, type VersionSkew } from '@renderer/lib/version-skew'

/**
 * Version skew between THIS renderer build and the daemon it's bound to, or null
 * when they match or it isn't known yet. Queried once (staleTime Infinity — a
 * daemon's version can't change under a live connection; a daemon restart pushes a
 * reconnect whose blanket `utils.invalidate()` in use-app-events refetches this too).
 *
 * A daemon older than 0.30 has no `daemonInfo` procedure, so the query fails with a
 * NOT_FOUND tRPC error (`No procedure found on path "daemonInfo"`). We detect that on
 * the typed query error's `data.code` and treat it as a definitely-older `pre-0.30`,
 * so the raw error never surfaces to a toast — the whole point of this guard.
 */
export function useDaemonSkew(): VersionSkew | null {
  const { data, error } = trpc.daemonInfo.useQuery(undefined, {
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  })
  const daemonVersion = data?.version ?? (error?.data?.code === 'NOT_FOUND' ? PRE_030 : null)
  if (daemonVersion === null) return null
  return computeVersionSkew(appVersion(), daemonVersion)
}
