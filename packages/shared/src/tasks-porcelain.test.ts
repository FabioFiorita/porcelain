import { describe, expect, it } from 'vitest'
import { isTaskShortId, nextTaskShortId } from './tasks-porcelain'

describe('Task short ids', () => {
  it('accepts T-1 and T-18 and rejects padding, zero, and a bare UUID', () => {
    expect(isTaskShortId('T-1')).toBe(true)
    expect(isTaskShortId('T-18')).toBe(true)
    expect(isTaskShortId('T-0')).toBe(false)
    expect(isTaskShortId('T-01')).toBe(false)
    expect(isTaskShortId('t-1')).toBe(false)
    expect(isTaskShortId('00000000-0000-4000-8000-000000000201')).toBe(false)
  })

  it('allocates T-1 on an empty table and T-n+1 after the highest existing id', () => {
    expect(nextTaskShortId([])).toBe('T-1')
    expect(nextTaskShortId([{ shortId: 'T-1' }, { shortId: 'T-3' }])).toBe('T-4')
    expect(nextTaskShortId([{ shortId: 'not-a-short-id' }])).toBe('T-1')
  })
})
