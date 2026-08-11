import { boardNotificationEffects } from '@porcelain/client-runtime/board'
import type { BoardChanged } from '@porcelain/contracts/board'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { primary } from '@renderer/lib/daemon'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import type { QueryClient } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { boardCardsQueryKey, isBoardCardsQueryKey } from './board-query-key'

/**
 * Board notification adapter (BRD-004).
 *
 * Accepts only a validated BRD-001 `board.changed` notification and maps BRD-003
 * effects onto the Web QueryClient. Does not inspect raw AppEvent strings.
 */

export type ApplyBoardNotificationOptions = {
  readonly queryClient: QueryClient
  readonly daemon: DaemonScope
}

/** Invalidate exactly the Project cards identities a Board change makes stale. */
export function applyBoardNotification(
  notification: BoardChanged,
  options: ApplyBoardNotificationOptions,
): void {
  for (const identity of boardNotificationEffects(notification)) {
    void options.queryClient.invalidateQueries({
      queryKey: boardCardsQueryKey(options.daemon, identity),
      exact: true,
    })
  }
}

/** Invalidate every Board cards cache entry (session/project recovery). */
export function invalidateAllBoardCards(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => isBoardCardsQueryKey(query.queryKey),
  })
}

/**
 * Subscribe once to session change signals and apply Board notifications.
 * Mounted from AppShell; Board event handling no longer lives in session-runtime.
 */
export function useBoardNotificationSubscription(): void {
  const queryClient = useQueryClient()
  const daemon = useDaemonIdentity()
  const host = daemon.host
  const version = daemon.version

  useEffect(() => {
    const daemonScope: DaemonScope = { host, version }
    return primary.onChange((change) => {
      if (change.kind !== 'board.changed') return
      applyBoardNotification(
        { kind: 'board.changed', projectPath: change.projectPath },
        { queryClient, daemon: daemonScope },
      )
    })
  }, [queryClient, host, version])
}
