// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createTestClock } from './test-clock'

describe('createTestClock', () => {
  it('returns distinct Date instances that share the current instant', () => {
    const initial = new Date('2026-08-10T12:00:00.000Z')
    const clock = createTestClock(initial)
    const a = clock.now()
    const b = clock.now()
    expect(a).not.toBe(b)
    expect(a.getTime()).toBe(initial.getTime())
    expect(b.getTime()).toBe(initial.getTime())
    expect(a).not.toBe(initial)
  })

  it('advances by an exact finite non-negative delta', () => {
    const clock = createTestClock(new Date('2026-08-10T00:00:00.000Z'))
    clock.advance(1500)
    expect(clock.now().toISOString()).toBe('2026-08-10T00:00:01.500Z')
    clock.advance(0)
    expect(clock.now().toISOString()).toBe('2026-08-10T00:00:01.500Z')
    clock.advance(500)
    expect(clock.now().getTime()).toBe(Date.parse('2026-08-10T00:00:02.000Z'))
  })

  it('rejects non-finite and negative advances', () => {
    const clock = createTestClock(new Date('2026-08-10T00:00:00.000Z'))
    expect(() => clock.advance(Number.NaN)).toThrow(/non-negative finite/)
    expect(() => clock.advance(Number.POSITIVE_INFINITY)).toThrow(/non-negative finite/)
    expect(() => clock.advance(Number.NEGATIVE_INFINITY)).toThrow(/non-negative finite/)
    expect(() => clock.advance(-1)).toThrow(/non-negative finite/)
    expect(clock.now().toISOString()).toBe('2026-08-10T00:00:00.000Z')
  })
})
