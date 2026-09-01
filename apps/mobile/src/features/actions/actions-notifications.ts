import { actionsNotificationEffects } from '@porcelain/client-runtime/actions'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import type { ActionsChanged } from '@porcelain/contracts/actions'
import { settleBackground } from '@porcelain/shared/background'
import type { QueryClient } from '@tanstack/react-query'

import { invalidateActionsIdentities, invalidateAllActionsQueries } from './actions-query-key'

/**
 * Mobile Actions notification adapter.
 *
 * Accepts only a validated `actions.changed` notification. Provider no longer lists `'actions'`.
 */

export type ApplyActionsNotificationOptions = {
  readonly queryClient: QueryClient
  readonly environmentId: string
}

/** Invalidate exactly the project list identities an Actions change makes stale. */
export function applyActionsNotification(
  notification: ActionsChanged,
  options: ApplyActionsNotificationOptions,
): void {
  settleBackground(
    invalidateActionsIdentities(
      options.queryClient,
      options.environmentId,
      actionsNotificationEffects(notification),
    ),
    'notification',
  )
}

/**
 * Recover Actions after a sequence gap. Actions are keyed by Project id while a
 * freshness scope names a checkout path, and one path cannot be turned back into the
 * Project that owns it from here — so any gap refetches every Actions list this client
 * holds rather than guessing which Project went stale.
 */
export function applyActionsFreshnessRequirement(
  _requirement: FreshnessRequirement,
  options: ApplyActionsNotificationOptions,
): void {
  settleBackground(invalidateAllActionsQueries(options.queryClient), 'notification')
}
