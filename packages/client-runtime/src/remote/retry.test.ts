import { describe, expect, it } from 'vitest'
import { reconnectDelayMs } from '../session/transport'
import {
  nextRemoteRetry,
  REMOTE_MAX_RETRY_MS,
  REMOTE_MIN_RETRY_MS,
  resetRemoteRetry,
} from './retry'

describe('remote retry', () => {
  it('resets to the 500 ms floor', () => {
    expect(resetRemoteRetry()).toBe(500)
    expect(resetRemoteRetry()).toBe(REMOTE_MIN_RETRY_MS)
  })

  it('doubles the delay to 10_000 and stays there', () => {
    const delays = [REMOTE_MIN_RETRY_MS]
    let current = REMOTE_MIN_RETRY_MS
    for (let step = 0; step < 6; step += 1) {
      current = nextRemoteRetry(current, () => 0).delayMs
      delays.push(current)
    }
    expect(delays).toEqual([500, 1_000, 2_000, 4_000, 8_000, 10_000, 10_000])
    expect(nextRemoteRetry(REMOTE_MAX_RETRY_MS, () => 0).delayMs).toBe(REMOTE_MAX_RETRY_MS)
  })

  it('waits reconnectDelayMs for injected random 0 and 1', () => {
    const zero = nextRemoteRetry(REMOTE_MIN_RETRY_MS, () => 0)
    const one = nextRemoteRetry(REMOTE_MIN_RETRY_MS, () => 1)
    expect(zero.waitMs).toBe(reconnectDelayMs(REMOTE_MIN_RETRY_MS, () => 0))
    expect(one.waitMs).toBe(reconnectDelayMs(REMOTE_MIN_RETRY_MS, () => 1))
    expect(zero.waitMs).toBe(500)
    expect(one.waitMs).toBe(650)
    expect(zero.delayMs).toBe(1_000)
    expect(one.delayMs).toBe(1_000)
  })

  it('requires an injected random and calls it', () => {
    let calls = 0
    nextRemoteRetry(REMOTE_MIN_RETRY_MS, () => {
      calls += 1
      return 0.5
    })
    expect(calls).toBe(1)
  })
})
