import type { SessionChange } from '@porcelain/contracts/session'
import type { BoardChanges } from './board-capabilities'

/**
 * Map the Board capability fact onto the RT-001 session change vocabulary.
 * Delivery is best-effort; failures do not reverse durable writes.
 */
export function createBoardChangesPublisher(
  publish: (change: SessionChange) => void,
): BoardChanges {
  return {
    publish(change) {
      publish({ kind: 'board.changed', projectPath: change.projectPath })
    },
  }
}
