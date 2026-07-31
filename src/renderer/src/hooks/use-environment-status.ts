import type { EnvironmentStatus } from '@main/shell-api'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc } from '@renderer/lib/trpc'
import { useMemo } from 'react'

/**
 * Live state (online / unauthorized / offline) + reported identity for This device
 * and every saved environment, keyed for lookup by environment id (`null` = local).
 *
 * Each read is one network probe PER environment on the shell side, so this is
 * deliberately lazy: a long staleTime, no interval, and refetch on window focus —
 * coming back to the app is exactly when a stale "offline" dot is worth re-checking,
 * and idling in another window is exactly when it isn't. Don't add a poll.
 *
 * Electron-only: the browser client is already served BY its daemon and has no saved
 * environments to compare (the whole feature hides there).
 */
export function useEnvironmentStatuses(): Map<string | null, EnvironmentStatus> {
  const { data } = shellTrpc.environmentStatuses.useQuery(undefined, {
    enabled: !isBrowser,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
  return useMemo<Map<string | null, EnvironmentStatus>>(
    () => new Map((data ?? []).map((status) => [status.id, status])),
    [data],
  )
}
