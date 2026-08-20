import { aggregateTaskRows, type TaskRow } from '@porcelain/client-runtime/tasks'
import type { Task } from '@porcelain/contracts/tasks'
import { useQueries } from '@tanstack/react-query'

import { isPaired, useEnvironments } from '@/features/remote'
import type { DaemonError } from '@/lib/daemon/errors'

import { listTasksProcedure } from './tasks-procedures'
import { tasksTableKey } from './tasks-query-key'
import { callTasksProcedure } from './use-tasks-transport'

/**
 * Reading the Tasks board — every paired Environment's table at once.
 *
 * Tasks are daemon-wide, so a phone paired with three machines has three tables and no reason
 * to make the human pick one first: the Environment is a label on the row, exactly as it is on
 * the Hub list. That is also why this is not built on `useActiveEnvironment` — the active
 * Environment says which checkout a surface is showing, and coordination outlives any one
 * checkout.
 *
 * An Environment that did not answer contributes no rows rather than stale ones, which is what
 * `aggregateTaskRows` assumes of its sources. The aggregation runs per render rather than
 * behind a memo, the same way `useHubInventories` joins its fan-out: with N query results there
 * is no stable dependency to memoize on, and a memo that never hits is a comment that lies.
 */

export type TasksBoard = {
  readonly rows: readonly TaskRow[]
  /** Environments contributing rows right now — the create sheet's target list. */
  readonly environments: readonly { id: string; name: string }[]
  /** Non-null when a read failed; distinct from unloaded and from an empty board. */
  readonly error: DaemonError | null
  /** False until every paired Environment has settled, succeeded or failed. */
  readonly isLoaded: boolean
}

export function useTasks(): TasksBoard {
  const paired = useEnvironments().filter(isPaired)
  const results = useQueries({
    queries: paired.map((environment) => ({
      queryFn: async (): Promise<Task[]> => [
        ...(await callTasksProcedure(environment, listTasksProcedure, undefined)),
      ],
      queryKey: tasksTableKey(environment.id),
    })),
  })

  // The nickname, not the host: two daemons on one machine answer on the same host string, and
  // the nickname is the name this device paired them under.
  const sources = paired.flatMap((environment, index) => {
    const tasks = results[index]?.data
    return tasks === undefined
      ? []
      : [{ environmentId: environment.id, environmentName: environment.nickname, tasks }]
  })
  const failed = results.find((result) => result.error != null)

  return {
    rows: aggregateTaskRows(sources),
    environments: sources.map((source) => ({
      id: source.environmentId,
      name: source.environmentName,
    })),
    error: (failed?.error as DaemonError | undefined) ?? null,
    isLoaded: results.every((result) => !result.isPending),
  }
}

/** One row by identity, read off the live board so a notification refreshes it in place. */
export function useTaskRow(taskId: string, environmentId: string): TaskRow | null {
  const { rows } = useTasks()
  return rows.find((row) => row.task.id === taskId && row.environmentId === environmentId) ?? null
}
