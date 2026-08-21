import { TASK_STATUSES } from '@porcelain/contracts/tasks'
import { describe, expect, it } from 'vitest'
import { OPEN_TASK_STATUSES, TASK_STATUS_LABELS } from './task-status'

describe('open Task statuses', () => {
  it('hides Done and keeps everything else in contract order', () => {
    expect(OPEN_TASK_STATUSES).toEqual(['todo', 'doing', 'blocked'])
    expect(OPEN_TASK_STATUSES).not.toContain('done')
  })

  it('names every status the contract can carry', () => {
    for (const status of TASK_STATUSES) expect(TASK_STATUS_LABELS[status]).toBeTruthy()
  })
})
