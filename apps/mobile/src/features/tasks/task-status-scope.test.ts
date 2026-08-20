import type { TaskRow } from '@porcelain/client-runtime/tasks'
import { taskFixture } from '@porcelain/contracts/tasks'
import { describe, expect, it } from 'vitest'

import {
  DEFAULT_TASK_STATUS_SCOPE,
  groupRowsByStatus,
  statusesInScope,
  taskStatusScopeOptions,
} from './task-status-scope'

function row(id: string, status: 'todo' | 'doing' | 'done' | 'blocked'): TaskRow {
  return {
    task: taskFixture({ id, status }),
    environmentId: 'env-1',
    environmentName: 'Studio',
  }
}

const TODO = '00000000-0000-4000-8000-000000000301'
const DOING = '00000000-0000-4000-8000-000000000302'
const DONE = '00000000-0000-4000-8000-000000000303'
const BLOCKED = '00000000-0000-4000-8000-000000000304'

describe('task status scope', () => {
  it('hides Done by default, matching the web filter', () => {
    expect(DEFAULT_TASK_STATUS_SCOPE).toBe('open')
    expect(statusesInScope(DEFAULT_TASK_STATUS_SCOPE)).toEqual(['todo', 'doing', 'blocked'])
    expect(statusesInScope('done')).toEqual(['done'])
  })

  it('offers one segment per scope, Open first', () => {
    expect(taskStatusScopeOptions().map((option) => option.value)).toEqual([
      'open',
      'todo',
      'doing',
      'done',
      'blocked',
    ])
    expect(taskStatusScopeOptions()[0]?.label).toBe('Open')
  })

  it('groups the scope in status order and drops empty sections', () => {
    const rows = [row(DONE, 'done'), row(BLOCKED, 'blocked'), row(TODO, 'todo')]
    expect(groupRowsByStatus(rows, 'open')).toEqual([
      { status: 'todo', rows: [rows[2]] },
      { status: 'blocked', rows: [rows[1]] },
    ])
    expect(groupRowsByStatus(rows, 'done')).toEqual([{ status: 'done', rows: [rows[0]] }])
  })

  it('keeps the aggregated row order inside a section rather than re-sorting', () => {
    const first = row(DOING, 'doing')
    const second = row(TODO, 'doing')
    expect(groupRowsByStatus([first, second], 'doing')[0]?.rows).toEqual([first, second])
  })
})
