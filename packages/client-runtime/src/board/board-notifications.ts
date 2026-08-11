import type { BoardChanged } from '@porcelain/contracts/board'
import { type BoardCardsQuery, boardCardsQuery } from './board-queries'

/**
 * Exhaustive Board notification → query identity mapping (BRD-003).
 *
 * Accepts only the BRD-001 `board.changed` notification. No default branch, no raw
 * event strings, no entity payload application — queries remain authoritative.
 */

/** Map a validated Board change notification to the affected typed query identities. */
export function boardNotificationEffects(notification: BoardChanged): readonly BoardCardsQuery[] {
  return [boardCardsQuery(notification.projectPath)]
}
