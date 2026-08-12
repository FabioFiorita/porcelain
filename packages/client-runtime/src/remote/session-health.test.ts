import { describe, expect, it } from 'vitest'
import {
  createSessionHealth,
  type RemoteSessionHealth,
  type RemoteSessionOutcome,
} from './session-health'

const start = { type: 'start' } as const
const stop = { type: 'stop' } as const
const connected = { type: 'connected' } as const
const disconnected = { type: 'disconnected' } as const
const exhausted = { type: 'walk-exhausted' } as const
const updateRequired = { type: 'update-required' } as const

function healthAfter(outcomes: readonly RemoteSessionOutcome[]) {
  const machine = createSessionHealth()
  for (const outcome of outcomes) machine.apply(outcome)
  return machine
}

describe('createSessionHealth', () => {
  it('starts idle and never connected', () => {
    const machine = createSessionHealth()
    expect(machine.status()).toBe('idle')
    expect(machine.everConnected()).toBe(false)
  })

  it('follows the six-state transition table', () => {
    const rows: Array<{
      seed: readonly RemoteSessionOutcome[]
      outcome: RemoteSessionOutcome
      status: RemoteSessionHealth
    }> = [
      { seed: [], outcome: start, status: 'connecting' },
      { seed: [start, exhausted], outcome: start, status: 'connecting' },
      { seed: [start], outcome: connected, status: 'healthy' },
      { seed: [start, connected, disconnected], outcome: connected, status: 'healthy' },
      { seed: [start, exhausted], outcome: connected, status: 'healthy' },
      { seed: [start], outcome: disconnected, status: 'connecting' },
      { seed: [start, connected], outcome: disconnected, status: 'recovering' },
      { seed: [start, connected, disconnected], outcome: disconnected, status: 'recovering' },
      { seed: [start], outcome: exhausted, status: 'unavailable' },
      { seed: [start, connected], outcome: exhausted, status: 'unavailable' },
      { seed: [start, connected, disconnected], outcome: exhausted, status: 'unavailable' },
      { seed: [start, exhausted], outcome: exhausted, status: 'unavailable' },
      { seed: [], outcome: exhausted, status: 'idle' },
      { seed: [], outcome: updateRequired, status: 'update-required' },
      { seed: [start], outcome: updateRequired, status: 'update-required' },
      { seed: [start, connected], outcome: updateRequired, status: 'update-required' },
      { seed: [], outcome: stop, status: 'idle' },
      { seed: [start], outcome: stop, status: 'idle' },
      { seed: [start, connected], outcome: stop, status: 'idle' },
      { seed: [start, connected, disconnected], outcome: stop, status: 'idle' },
      { seed: [start, exhausted], outcome: stop, status: 'idle' },
      { seed: [start], outcome: start, status: 'connecting' },
      { seed: [start, connected], outcome: start, status: 'healthy' },
      { seed: [start, connected, disconnected], outcome: start, status: 'recovering' },
      { seed: [], outcome: disconnected, status: 'idle' },
      { seed: [], outcome: connected, status: 'idle' },
    ]

    for (const row of rows) {
      expect(healthAfter([...row.seed, row.outcome]).status()).toBe(row.status)
    }
  })

  it('treats update-required as absorbing', () => {
    const later: RemoteSessionOutcome[] = [start, stop, connected, disconnected, exhausted]
    for (const outcome of later) {
      const machine = healthAfter([updateRequired])
      expect(machine.apply(outcome)).toBe('update-required')
      expect(machine.status()).toBe('update-required')
    }
  })

  it('flips everConnected only on connected', () => {
    const machine = createSessionHealth()
    machine.apply(start)
    machine.apply(disconnected)
    machine.apply(stop)
    machine.apply(exhausted)
    machine.apply(connected)
    expect(machine.everConnected()).toBe(false)
    expect(machine.status()).toBe('idle')

    machine.apply(start)
    machine.apply(connected)
    expect(machine.everConnected()).toBe(true)
    expect(machine.status()).toBe('healthy')

    machine.apply(disconnected)
    machine.apply(stop)
    machine.apply(start)
    expect(machine.everConnected()).toBe(true)
    expect(machine.status()).toBe('connecting')
  })

  it('becomes unavailable on one walk-exhausted without hysteresis', () => {
    const machine = healthAfter([start, exhausted])
    expect(machine.status()).toBe('unavailable')
    expect(machine.apply(exhausted)).toBe('unavailable')
    expect(machine.apply(start)).toBe('connecting')
  })
})
