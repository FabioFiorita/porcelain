import { boardNotificationEffects } from '@porcelain/client-runtime/board'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import type { BoardChanged } from '@porcelain/contracts/board'
import { settleBackground } from '@porcelain/shared/background'
import type { QueryClient } from '@tanstack/react-query'

import { boardCardsQueryKeyForIdentity } from './board-query-key'

/**
 * Board notification adapter (BRD-005).
 *
 * Accepts only a validated BRD-001 `board.changed` notification and maps BRD-003
 * effects onto the mobile QueryClient for the active environment. Does not inspect
 * raw AppEvent strings.
 */

export type ApplyBoardNotificationOptions = {
  readonly queryClient: QueryClient
  readonly environmentId: string
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
        queryKey: boardCardsQueryKeyForIdentity(options.environmentId, identity),
        exact: true,
      }),
      'notification',
    )
  }
}

/** Recover the exact Board query when the session reports a project-scoped sequence gap. */
export function applyBoardFreshnessRequirement(
  requirement: FreshnessRequirement,
  options: ApplyBoardNotificationOptions,
): void {
  if (requirement.scope.kind !== 'project') return
  applyBoardNotification(
    { kind: 'board.changed', projectPath: requirement.scope.projectPath },
    options,
  )
}
