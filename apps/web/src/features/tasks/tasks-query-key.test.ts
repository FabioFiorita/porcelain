import { tasksTableQuery } from '@porcelain/client-runtime/tasks'
import { describe, expect, it } from 'vitest'
import { isTasksTableQueryKey, tasksKeyForEnvironment, tasksTableQueryKey } from './tasks-query-key'

const DAEMON = { host: 'beelink', version: '0.52.1' }
const ENVIRONMENT = 'environment-a'

describe('tasksTableQueryKey', () => {
  it('composes identity + daemon scope', () => {
    const identity = tasksTableQuery(ENVIRONMENT)
    expect(tasksTableQueryKey(DAEMON, identity)).toEqual([
      identity,
      { host: DAEMON.host, version: DAEMON.version },
    ])
  })

  it('keys each Environment separately under the same daemon scope', () => {
    const local = tasksKeyForEnvironment(DAEMON, null)
    const remote = tasksKeyForEnvironment(DAEMON, ENVIRONMENT)
    expect(local[0]).toEqual({ domain: 'tasks', name: 'table', environmentId: null })
    expect(remote[0]).toEqual({ domain: 'tasks', name: 'table', environmentId: ENVIRONMENT })
    expect(local[0]).not.toEqual(remote[0])
    expect(local[1]).toEqual(remote[1])
  })
})

describe('Tasks query-key parsing', () => {
  const IDENTITY = tasksTableQuery(ENVIRONMENT)

  it('accepts a well-formed key and a null-identity daemon scope', () => {
    expect(isTasksTableQueryKey(tasksTableQueryKey(DAEMON, IDENTITY))).toBe(true)
    expect(isTasksTableQueryKey(tasksKeyForEnvironment(DAEMON, null))).toBe(true)
    expect(isTasksTableQueryKey([IDENTITY, { host: null, version: null }])).toBe(true)
  })

  it('rejects a malformed daemon scope', () => {
    expect(isTasksTableQueryKey([IDENTITY, { host: 'beelink' }])).toBe(false)
    expect(isTasksTableQueryKey([IDENTITY, { host: null, version: 2 }])).toBe(false)
    expect(isTasksTableQueryKey([IDENTITY, { host: null, version: null, extra: true }])).toBe(false)
    expect(isTasksTableQueryKey([IDENTITY, null])).toBe(false)
    expect(isTasksTableQueryKey([IDENTITY])).toBe(false)
  })

  it('rejects malformed identities and foreign key layouts', () => {
    expect(isTasksTableQueryKey([{ domain: 'tasks', name: 'table' }, DAEMON])).toBe(false)
    expect(
      isTasksTableQueryKey([{ domain: 'tasks', name: 'table', environmentId: 7 }, DAEMON]),
    ).toBe(false)
    expect(
      isTasksTableQueryKey([{ domain: 'tasks', name: 'table', environmentId: '' }, DAEMON]),
    ).toBe(false)
    expect(isTasksTableQueryKey([{ ...IDENTITY, extra: true }, DAEMON])).toBe(false)
    expect(
      isTasksTableQueryKey([{ domain: 'board', name: 'table', environmentId: null }, DAEMON]),
    ).toBe(false)
    // The shell fan-out cache entry is not a Tasks table key.
    expect(isTasksTableQueryKey([['environmentTasks']])).toBe(false)
    expect(isTasksTableQueryKey([IDENTITY, DAEMON, 'extra'])).toBe(false)
  })
})
