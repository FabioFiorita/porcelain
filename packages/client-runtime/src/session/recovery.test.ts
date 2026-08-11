import { type SessionChangeFrame, sessionChangeFrameSchema } from '@porcelain/contracts/session'
import { describe, expect, it } from 'vitest'
import { createSessionFreshnessTracker } from './recovery'

const EPOCH = 'synthetic-epoch'
const PROJECT = '/synthetic/repo'

function changeFrame({
  epoch = EPOCH,
  sequence,
  projectPath = PROJECT,
}: {
  epoch?: string
  sequence: number
  projectPath?: string
}): SessionChangeFrame {
  return sessionChangeFrameSchema.parse({
    t: 'session:change',
    epoch,
    sequence,
    change: { kind: 'board.changed', projectPath },
  })
}

describe('Session freshness tracker', () => {
  it('requires nothing on the first connection, which has missed nothing', () => {
    const tracker = createSessionFreshnessTracker()

    expect(tracker.ready({ epoch: EPOCH })).toBeUndefined()
    expect(tracker.epoch()).toBe(EPOCH)
    expect(tracker.sequence()).toBeUndefined()
  })

  it('accepts contiguous sequences without requiring a refresh', () => {
    const tracker = createSessionFreshnessTracker()
    tracker.ready({ epoch: EPOCH })

    for (const sequence of [0, 1, 2]) {
      const observed = tracker.observe(changeFrame({ sequence }))
      expect(observed.requirement).toBeUndefined()
      expect(observed.change).toEqual({ kind: 'board.changed', projectPath: PROJECT })
    }
    expect(tracker.sequence()).toBe(2)
  })

  it('reads a jump as a gap and marks that project stale', () => {
    const tracker = createSessionFreshnessTracker()
    tracker.ready({ epoch: EPOCH })
    tracker.observe(changeFrame({ sequence: 0 }))

    const observed = tracker.observe(changeFrame({ sequence: 4 }))

    expect(observed.requirement).toEqual({
      reason: 'sequence-gap',
      scope: { kind: 'project', projectPath: PROJECT },
    })
    // The change is still applied; recovery replaces nothing it did not see.
    expect(observed.change).toEqual({ kind: 'board.changed', projectPath: PROJECT })
    expect(tracker.sequence()).toBe(4)
  })

  it('resumes contiguously after a gap instead of reporting it twice', () => {
    const tracker = createSessionFreshnessTracker()
    tracker.ready({ epoch: EPOCH })
    tracker.observe(changeFrame({ sequence: 0 }))
    tracker.observe(changeFrame({ sequence: 4 }))

    expect(tracker.observe(changeFrame({ sequence: 5 })).requirement).toBeUndefined()
  })

  it('treats a repeated sequence as a duplicate, not a gap', () => {
    const tracker = createSessionFreshnessTracker()
    tracker.ready({ epoch: EPOCH })
    tracker.observe(changeFrame({ sequence: 0 }))
    tracker.observe(changeFrame({ sequence: 1 }))

    expect(tracker.observe(changeFrame({ sequence: 1 })).requirement).toBeUndefined()
    expect(tracker.sequence()).toBe(1)
    expect(tracker.observe(changeFrame({ sequence: 2 })).requirement).toBeUndefined()
  })

  it('treats a reconnect to the same daemon as its own recovery point', () => {
    const tracker = createSessionFreshnessTracker()
    tracker.ready({ epoch: EPOCH })
    tracker.observe(changeFrame({ sequence: 0 }))
    tracker.disconnected()

    expect(tracker.ready({ epoch: EPOCH })).toEqual({
      reason: 'reconnect',
      scope: { kind: 'session' },
    })
  })

  it('does not read the daemon restarting a subscription sequence as a gap', () => {
    const tracker = createSessionFreshnessTracker()
    tracker.ready({ epoch: EPOCH })
    tracker.observe(changeFrame({ sequence: 7 }))
    tracker.disconnected()
    tracker.ready({ epoch: EPOCH })

    // The daemon sequences per subscription, so a new connection starts back at 0.
    expect(tracker.observe(changeFrame({ sequence: 0 })).requirement).toBeUndefined()
    expect(tracker.observe(changeFrame({ sequence: 1 })).requirement).toBeUndefined()
  })

  it('reports a reconnect to a replaced daemon as an epoch change', () => {
    const tracker = createSessionFreshnessTracker()
    tracker.ready({ epoch: EPOCH })
    tracker.disconnected()

    expect(tracker.ready({ epoch: 'synthetic-epoch-2' })).toEqual({
      reason: 'epoch-changed',
      scope: { kind: 'session' },
    })
    expect(tracker.epoch()).toBe('synthetic-epoch-2')
  })

  it('reports an epoch change arriving mid-connection and adopts the new epoch', () => {
    const tracker = createSessionFreshnessTracker()
    tracker.ready({ epoch: EPOCH })
    tracker.observe(changeFrame({ sequence: 3 }))

    const observed = tracker.observe(changeFrame({ epoch: 'synthetic-epoch-2', sequence: 0 }))

    expect(observed.requirement).toEqual({ reason: 'epoch-changed', scope: { kind: 'session' } })
    expect(tracker.epoch()).toBe('synthetic-epoch-2')
    expect(
      tracker.observe(changeFrame({ epoch: 'synthetic-epoch-2', sequence: 1 })).requirement,
    ).toBeUndefined()
  })
})
