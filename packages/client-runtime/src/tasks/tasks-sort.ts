import type { TaskRow } from './tasks-rows'

/**
 * Newest-updated first, ties broken by Environment then Task id.
 *
 * A total order matters more than the specific one: rows come from several daemons whose
 * clocks are independent, so `updatedAt` alone leaves ties that would otherwise reshuffle on
 * every refetch and make the table look alive when nothing changed.
 */
export function sortTaskRows(rows: readonly TaskRow[]): TaskRow[] {
  return [...rows].sort((left, right) => {
    if (left.task.updatedAt !== right.task.updatedAt) {
      return left.task.updatedAt < right.task.updatedAt ? 1 : -1
    }
    const leftEnvironment = left.environmentId ?? ''
    const rightEnvironment = right.environmentId ?? ''
    if (leftEnvironment !== rightEnvironment) return leftEnvironment < rightEnvironment ? -1 : 1
    return left.task.id < right.task.id ? -1 : 1
  })
}
