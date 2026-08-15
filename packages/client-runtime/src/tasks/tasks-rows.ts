import type { Task } from '@porcelain/contracts/tasks'
import { sortTaskRows } from './tasks-sort'

/**
 * One row of the aggregated Tasks table: a Task plus the Environment whose daemon owns it.
 *
 * The Environment is added by the CLIENT, not the wire — a daemon has no name for itself in
 * the Hub's vocabulary, and a row that carried a self-reported Environment id could claim to
 * belong to a machine it never came from. Mutating this row means calling back the exact
 * daemon named here.
 */
export type TaskRow = Readonly<{
  task: Task
  /** `null` for the single directly-connected daemon (the browser client). */
  environmentId: string | null
  environmentName: string
}>

/** One Environment's contribution to the aggregate. */
export type TaskSource = Readonly<{
  environmentId: string | null
  environmentName: string
  tasks: readonly Task[]
}>

/**
 * Flatten the connected Environments' tables into one ordered row set.
 *
 * Offline Environments are omitted by never appearing as a source — the aggregation layer
 * drops them rather than rendering stale rows (issue #18, story 5), so this function has no
 * "stale" state to represent.
 */
export function aggregateTaskRows(sources: readonly TaskSource[]): TaskRow[] {
  const rows: TaskRow[] = []
  for (const source of sources) {
    for (const task of source.tasks) {
      rows.push({
        task,
        environmentId: source.environmentId,
        environmentName: source.environmentName,
      })
    }
  }
  return sortTaskRows(rows)
}
