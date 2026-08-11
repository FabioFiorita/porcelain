import { describe, expect, it } from 'vitest'
import {
  MAX_RETRY_MS,
  MIN_RETRY_MS,
  nextRetryDelay,
  REVOKED_CLOSE_CODE,
  reconnectDelayMs,
  sessionSubprotocol,
  sessionWebSocketUrl,
} from './transport'

describe('session transport helpers', () => {
  it('builds a session WebSocket URL from an HTTP origin', () => {
    expect(sessionWebSocketUrl('http://127.0.0.1:43118')).toBe('ws://127.0.0.1:43118/session')
    expect(sessionWebSocketUrl('https://porcelain.example')).toBe('wss://porcelain.example/session')
  })

  it('carries the token as a subprotocol, never a query string', () => {
    expect(sessionSubprotocol('pc_client_web')).toBe('porcelain.pc_client_web')
  })

  it('caps exponential backoff and keeps the revoked close code', () => {
    expect(nextRetryDelay(MIN_RETRY_MS)).toBe(1_000)
    expect(nextRetryDelay(MAX_RETRY_MS)).toBe(MAX_RETRY_MS)
    expect(REVOKED_CLOSE_CODE).toBe(4001)
    expect(reconnectDelayMs(1_000, () => 0)).toBe(1_000)
    expect(reconnectDelayMs(1_000, () => 1)).toBe(1_300)
  })
})
