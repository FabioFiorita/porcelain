import { actionsNotificationEffects } from '@porcelain/client-runtime/actions'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import type { ActionsChanged } from '@porcelain/contracts/actions'
import { settleBackground } from '@porcelain/shared/background'
import type { QueryClient } from '@tanstack/react-query'

import { invalidateActionsIdentities } from './actions-query-key'

/**
 * Mobile Actions notification adapter (ACT-003).
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

/** Recover Actions for a project-scoped sequence gap. */
export function applyActionsFreshnessRequirement(
  requirement: FreshnessRequirement,
  options: ApplyActionsNotificationOptions,
): void {
  if (requirement.scope.kind !== 'project') return
  applyActionsNotification(
    { kind: 'actions.changed', projectPath: requirement.scope.projectPath },
    options,
  )
}
