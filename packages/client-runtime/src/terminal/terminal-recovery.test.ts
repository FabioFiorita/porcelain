import { describe, expect, it } from 'vitest'
import { terminalRecovery } from './terminal-recovery'

describe('Terminal recovery effects', () => {
  it.each([
    'reconnect',
    'epoch-changed',
    'sequence-gap',
  ] as const)('creates a frozen %s recovery with a sorted unique attachment list', (reason) => {
    const recovery = terminalRecovery(reason, ['term-b', 'term-a', 'term-b'])

    expect(recovery).toEqual({
      reason,
      reattach: ['term-a', 'term-b'],
      refreshRoster: true,
    })
    expect(Object.isFrozen(recovery)).toBe(true)
    expect(Object.isFrozen(recovery.reattach)).toBe(true)
  })
})
