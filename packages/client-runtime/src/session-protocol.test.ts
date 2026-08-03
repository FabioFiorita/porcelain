import { describe, expect, it } from 'vitest'
import {
  MAX_RETRY_MS,
  MIN_RETRY_MS,
  nextRetryDelay,
  parseServerMessage,
  REVOKED_CLOSE_CODE,
  reconnectDelayMs,
  sessionSubprotocol,
  sessionWebSocketUrl,
  unionWatchPaths,
} from './session-protocol'

describe('sessionWebSocketUrl', () => {
  it('upgrades http to ws and appends /session', () => {
    expect(sessionWebSocketUrl('http://127.0.0.1:43118')).toBe('ws://127.0.0.1:43118/session')
  })
  it('upgrades https to wss', () => {
    expect(sessionWebSocketUrl('https://host.ts.net')).toBe('wss://host.ts.net/session')
  })
})

describe('sessionSubprotocol', () => {
  it('prefixes the token', () => {
    expect(sessionSubprotocol('abc')).toBe('porcelain.abc')
  })
})

describe('nextRetryDelay', () => {
  it('doubles until the cap', () => {
    expect(nextRetryDelay(MIN_RETRY_MS)).toBe(1000)
    expect(nextRetryDelay(MAX_RETRY_MS)).toBe(MAX_RETRY_MS)
    expect(nextRetryDelay(5000, 10_000)).toBe(10_000)
  })
})

describe('reconnectDelayMs', () => {
  it('adds bounded jitter', () => {
    expect(reconnectDelayMs(1000, () => 0)).toBe(1000)
    expect(reconnectDelayMs(1000, () => 1)).toBe(1300)
  })
})

describe('parseServerMessage', () => {
  it('accepts a known frame', () => {
    const frame = parseServerMessage(JSON.stringify({ t: 'app-event', event: 'board' }))
    expect(frame?.t).toBe('app-event')
  })
  it('rejects garbage', () => {
    expect(parseServerMessage('not-json')).toBeNull()
    expect(parseServerMessage('{}')).toBeNull()
  })
})

describe('unionWatchPaths', () => {
  it('dedupes across registrations', () => {
    expect(
      unionWatchPaths([
        { files: ['a.ts', 'b.ts'], dirs: ['src'] },
        { files: ['b.ts'], dirs: ['src', 'lib'] },
      ]),
    ).toEqual({ files: ['a.ts', 'b.ts'], dirs: ['src', 'lib'] })
  })
})

describe('REVOKED_CLOSE_CODE', () => {
  it('is the daemon contract code', () => {
    expect(REVOKED_CLOSE_CODE).toBe(4001)
  })
})
