import type { SessionChange } from '@porcelain/contracts/session'
import type { TasksChanges } from './tasks-capabilities'

/**
 * Map the Tasks capability fact onto the session change vocabulary.
 * Delivery is best-effort; failures do not reverse durable writes.
 */
export function createTasksChangesPublisher(
  publish: (change: SessionChange) => void,
): TasksChanges {
  return {
    publish() {
      publish({ kind: 'tasks.changed' })
    },
  }
}
