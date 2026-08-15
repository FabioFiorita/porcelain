import type { SessionChange } from '@porcelain/contracts/session'
import type { ActionsChanges } from './actions-ports'

/**
 * Map the Actions capability fact onto the RT-001 session change vocabulary.
 * Delivery is best-effort; failures do not reverse durable writes.
 */
export function createActionsChangesPublisher(
  publish: (change: SessionChange) => void,
): ActionsChanges {
  return {
    publish(change) {
      publish({ kind: 'actions.changed', projectId: change.projectId })
    },
  }
}
