import { boardNotificationEffects } from '@porcelain/client-runtime/board'
import type { BoardChanged } from '@porcelain/contracts/board'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { settleBackground } from '@shared/background'
import type { QueryClient } from '@tanstack/react-query'
import { boardCardsQueryKey } from './board-query-key'

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
    // Sync notification edge: settle in the background; query errors surface on refetch.
    settleBackground(
      options.queryClient.invalidateQueries({
        queryKey: boardCardsQueryKey(options.daemon, identity),
        exact: true,
      }),
      'notification',
    )
  }
}
