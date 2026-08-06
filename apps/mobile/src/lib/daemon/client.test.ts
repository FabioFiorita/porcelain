import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTimeoutFetch, PROBE_TIMEOUT_MS } from './client'

function pendingFetchCapturingSignal(): {
  fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  signal(): AbortSignal | undefined
} {
  let captured: AbortSignal | undefined
  const fetchImpl = (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    captured = init?.signal ?? undefined
    return new Promise((_resolve, reject) => {
      captured?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'))
      })
    })
  }
  return { fetchImpl, signal: (): AbortSignal | undefined => captured }
}

/**
 * `createTimeoutFetch` is the actual fix for the failover bug: plain `fetch` has no connect
 * timeout, so a LAN address dialed from off that LAN (phone now on cellular, or another Wi-Fi)
 * stays routable and just hangs — tens of seconds to minutes — instead of failing. Reachability
 * tracking (`environments-store.ts`) never saw a failure to count, so the endpoint walk that
 * already existed in `provider.ts` never fired.
 *
 * The budget must not apply uniformly, though: `gitGenerateCommitMessage` /
 * `gitGenerateCommitGroups` (`procedures/changes.ts`) legitimately run tens of seconds against a
 * daemon that is very much alive. `PROBE_TIMEOUT_MS` is only for the bootstrap/reachability walk
 * in `provider.tsx`; regular traffic through `getDaemonClient` gets a much larger budget. These
 * tests prove both halves: the probe budget still fails fast, and a long-but-alive call survives
 * well past it under the regular-traffic budget.
 */
describe('createTimeoutFetch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('aborts a dead endpoint at the probe budget instead of hanging past it', async () => {
    const { fetchImpl, signal } = pendingFetchCapturingSignal()
    vi.stubGlobal('fetch', vi.fn(fetchImpl))

    const result = createTimeoutFetch(PROBE_TIMEOUT_MS)('http://192.168.1.50:43117/trpc')
    const assertion = expect(result).rejects.toThrow(/aborted/i)

    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS)

    await assertion
    expect(signal()?.aborted).toBe(true)
  })

  it('lets a long-running mutation survive well past the probe budget under the regular-traffic timeout', async () => {
    let capturedSignal: AbortSignal | undefined
    const response = new Response('{}', { status: 200 })
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        capturedSignal = init?.signal ?? undefined
        // A commit-message-generation-shaped call: alive the whole time, just slow.
        return new Promise<Response>((resolve) => {
          setTimeout(() => resolve(response), PROBE_TIMEOUT_MS * 3)
        })
      }),
    )

    // 120s — the regular-traffic budget `getDaemonClient` uses (`createDaemonClient`'s default),
    // not the 10s `PROBE_TIMEOUT_MS` bootstrap uses to detect a dead connect.
    const result = createTimeoutFetch(120_000)('http://beelink.local:43117/trpc')

    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS + 5_000) // past the old, wrong 10s cutoff
    expect(capturedSignal?.aborted).toBe(false)

    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS * 2)
    expect(await result).toBe(response)
  })

  it('resolves normally when the daemon answers well inside the budget', async () => {
    const response = new Response('{}', { status: 200 })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response),
    )

    const result = await createTimeoutFetch(PROBE_TIMEOUT_MS)('http://192.168.1.50:43117/trpc')

    expect(result).toBe(response)
  })

  it('does not fire the timeout once the response has already settled', async () => {
    const response = new Response('{}', { status: 200 })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response),
    )

    await createTimeoutFetch(PROBE_TIMEOUT_MS)('http://192.168.1.50:43117/trpc')
    // The pending timer is cleared on settle; running it out must not throw unhandled.
    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS * 2)
  })

  it('still honors an externally supplied AbortSignal (React Query cancellation)', async () => {
    const controller = new AbortController()
    const { fetchImpl, signal } = pendingFetchCapturingSignal()
    vi.stubGlobal('fetch', vi.fn(fetchImpl))

    const result = createTimeoutFetch(PROBE_TIMEOUT_MS)('http://192.168.1.50:43117/trpc', {
      signal: controller.signal,
    })
    const assertion = expect(result).rejects.toThrow(/aborted/i)
    controller.abort()

    await assertion
    expect(signal()?.aborted).toBe(true)
  })
})
