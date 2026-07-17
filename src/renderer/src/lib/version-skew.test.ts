import { describe, expect, it } from 'vitest'
import { computeVersionSkew, PRE_030 } from './version-skew'

describe('computeVersionSkew', () => {
  it('returns null when the versions match exactly', () => {
    expect(computeVersionSkew('0.29.2', '0.29.2')).toBeNull()
  })

  it('flags an older daemon and tells the human to restart it (the motivating incident)', () => {
    const skew = computeVersionSkew('0.29.2', '0.28.2')
    expect(skew).not.toBeNull()
    expect(skew?.daemonIsOlder).toBe(true)
    expect(skew?.message).toBe('Daemon v0.28.2 · app v0.29.2 — restart the remote daemon to update')
  })

  it('flags a newer daemon and tells the human to update the app', () => {
    const skew = computeVersionSkew('0.29.2', '0.30.0')
    expect(skew?.daemonIsOlder).toBe(false)
    expect(skew?.message).toBe('Daemon v0.30.0 · app v0.29.2 — update this app to match the daemon')
  })

  it('treats the pre-0.30 sentinel as older and shows it un-prefixed', () => {
    const skew = computeVersionSkew('0.29.2', PRE_030)
    expect(skew?.daemonIsOlder).toBe(true)
    expect(skew?.message).toBe(
      'Daemon pre-0.30 · app v0.29.2 — restart the remote daemon to update',
    )
  })

  it('compares numerically, not lexically (0.9.0 daemon is older than 0.10.0 app)', () => {
    const skew = computeVersionSkew('0.10.0', '0.9.0')
    expect(skew?.daemonIsOlder).toBe(true)
  })

  it('orders by major, then minor, then patch', () => {
    expect(computeVersionSkew('1.0.0', '0.99.99')?.daemonIsOlder).toBe(true)
    expect(computeVersionSkew('0.29.2', '0.29.10')?.daemonIsOlder).toBe(false)
  })

  it('carries the raw versions through for the caller', () => {
    const skew = computeVersionSkew('0.29.2', '0.28.2')
    expect(skew?.appVersion).toBe('0.29.2')
    expect(skew?.daemonVersion).toBe('0.28.2')
  })
})
