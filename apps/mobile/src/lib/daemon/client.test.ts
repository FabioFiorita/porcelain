import { REQUEST_TIMEOUT_MS } from '@porcelain/client-runtime/session-protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchWithTimeout } from './client'

/**
 * `fetchWithTimeout` is the actual fix for the failover bug: plain `fetch` has no connect
 * timeout, so a LAN address dialed from off that LAN (phone now on cellular, or another Wi-Fi)
 * stays routable and just hangs — tens of seconds to minutes — instead of failing. Reachability
 * tracking (`environments-store.ts`) never saw a failure to count, so the endpoint walk that
 * already existed in `provider.ts` never fired. This proves the seam aborts on its own budget.
 */
describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('aborts a request that never answers instead of hanging past the reachability budget', async () => {
    let capturedSignal: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        capturedSignal = init?.signal ?? undefined
        return new Promise((_resolve, reject) => {
          capturedSignal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        })
      }),
    )

    const result = fetchWithTimeout('http://192.168.1.50:43117/trpc')
    const assertion = expect(result).rejects.toThrow(/aborted/i)

    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)

    await assertion
    expect(capturedSignal?.aborted).toBe(true)
  })

  it('resolves normally when the daemon answers well inside the budget', async () => {
    const response = new Response('{}', { status: 200 })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response),
    )

    const result = await fetchWithTimeout('http://192.168.1.50:43117/trpc')

    expect(result).toBe(response)
  })

  it('does not fire the timeout once the response has already settled', async () => {
    const response = new Response('{}', { status: 200 })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response),
    )

    await fetchWithTimeout('http://192.168.1.50:43117/trpc')
    // The pending timer is cleared on settle; running it out must not throw unhandled.
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS * 2)
  })

  it('still honors an externally supplied AbortSignal (React Query cancellation)', async () => {
    const controller = new AbortController()
    let capturedSignal: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        capturedSignal = init?.signal ?? undefined
        return new Promise((_resolve, reject) => {
          capturedSignal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        })
      }),
    )

    const result = fetchWithTimeout('http://192.168.1.50:43117/trpc', {
      signal: controller.signal,
    })
    const assertion = expect(result).rejects.toThrow(/aborted/i)
    controller.abort()

    await assertion
  })
})
