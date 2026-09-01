import type { ActionsChanged } from '@porcelain/contracts/actions'
import {
  type ActionsQuery,
  type ActionTrustQuery,
  actionsProjectKey,
  actionsQuery,
  actionTrustQuery,
} from './actions-queries'

/**
 * Exhaustive Actions notification → query identity mapping.
 *
 * Accepts only the `actions.changed` fact. No default branch, no raw
 * session-event strings, no entity payload merge. Trust is not a separate wire notification —
 * list refetch re-derives `trusted`.
 */

/** Map a validated Actions change notification to the affected typed query identities. */
export function actionsNotificationEffects(
  notification: ActionsChanged,
): readonly [ActionsQuery, ActionTrustQuery] {
  const key = actionsProjectKey(notification.projectId)
  return [actionsQuery(key), actionTrustQuery(key)]
}
