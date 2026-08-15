import { taskFixture } from '@porcelain/contracts/tasks'
import { describe, expect, it } from 'vitest'
import { aggregateTaskRows, type TaskSource } from './tasks-rows'

const OLDER = '2026-01-01T00:00:00.000Z'
const NEWER = '2026-02-01T00:00:00.000Z'

const LOCAL_TASK = taskFixture({
  id: '00000000-0000-4000-8000-0000000000a1',
  title: 'Local newest',
  updatedAt: NEWER,
})
const LOCAL_OLDER_TASK = taskFixture({
  id: '00000000-0000-4000-8000-0000000000a2',
  title: 'Local oldest',
  updatedAt: OLDER,
})
const REMOTE_TASK = taskFixture({
  id: '00000000-0000-4000-8000-0000000000b1',
  title: 'Remote',
  updatedAt: OLDER,
})

const local: TaskSource = {
  environmentId: null,
  environmentName: 'This device',
  tasks: [LOCAL_OLDER_TASK, LOCAL_TASK],
}

const remote: TaskSource = {
  environmentId: 'environment-b',
  environmentName: 'Studio',
  tasks: [REMOTE_TASK],
}

const rowIds = (sources: readonly TaskSource[]): string[] =>
  aggregateTaskRows(sources).map((row) => `${row.environmentId ?? 'local'}:${row.task.id}`)

describe('aggregateTaskRows', () => {
  it('labels every row with the Environment that answered for it', () => {
    const rows = aggregateTaskRows([local, remote])
    expect(rows).toHaveLength(3)
    expect(rows.map((row) => [row.task.id, row.environmentId, row.environmentName])).toEqual([
      [LOCAL_TASK.id, null, 'This device'],
      [LOCAL_OLDER_TASK.id, null, 'This device'],
      [REMOTE_TASK.id, 'environment-b', 'Studio'],
    ])
    // The Task itself is passed through untouched — the label is the client's, not the wire's.
    expect(rows[0]?.task).toEqual(LOCAL_TASK)
  })

  it('orders newest-updated first across Environments', () => {
    const rows = aggregateTaskRows([remote, local])
    expect(rows.map((row) => row.task.updatedAt)).toEqual([NEWER, OLDER, OLDER])
    expect(rows[0]?.task.id).toBe(LOCAL_TASK.id)
  })

  it('breaks an equal updatedAt by Environment, then by Task id', () => {
    const sameTimeLocal = taskFixture({
      id: '00000000-0000-4000-8000-0000000000c2',
      title: 'Local tie, later id',
      updatedAt: OLDER,
    })
    const rows = aggregateTaskRows([
      { ...remote, tasks: [REMOTE_TASK] },
      { ...local, tasks: [LOCAL_OLDER_TASK, sameTimeLocal] },
    ])
    // The directly-connected daemon sorts ahead of a named Environment, and within it the
    // lower Task id comes first — the same rows can never reshuffle between refetches.
    expect(rows.map((row) => row.task.id)).toEqual([
      LOCAL_OLDER_TASK.id,
      sameTimeLocal.id,
      REMOTE_TASK.id,
    ])
  })

  it('produces the same total order for the same input and for swapped sources', () => {
    const once = rowIds([local, remote])
    const again = rowIds([local, remote])
    const swapped = rowIds([remote, local])
    expect(again).toEqual(once)
    expect(swapped).toEqual(once)
    expect(once).toEqual([
      `local:${LOCAL_TASK.id}`,
      `local:${LOCAL_OLDER_TASK.id}`,
      `environment-b:${REMOTE_TASK.id}`,
    ])
  })

  it('contributes nothing for an Environment that is not a source — that is offline omission', () => {
    const withoutRemote = aggregateTaskRows([local])
    expect(withoutRemote.map((row) => row.task.id)).toEqual([LOCAL_TASK.id, LOCAL_OLDER_TASK.id])
    expect(withoutRemote.some((row) => row.environmentId === 'environment-b')).toBe(false)
    expect(aggregateTaskRows([])).toEqual([])
    expect(aggregateTaskRows([{ ...remote, tasks: [] }])).toEqual([])
  })

  it('leaves the source arrays it was handed untouched', () => {
    const tasks = [LOCAL_OLDER_TASK, LOCAL_TASK]
    aggregateTaskRows([{ environmentId: null, environmentName: 'This device', tasks }])
    expect(tasks).toEqual([LOCAL_OLDER_TASK, LOCAL_TASK])
  })
})
