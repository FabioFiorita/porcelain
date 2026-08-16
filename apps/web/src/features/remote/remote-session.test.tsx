import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
import { setBrowserDaemonToken } from '@renderer/lib/daemon'
import { trpcClient } from '@renderer/lib/trpc'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTokenGate } from './remote-session'

vi.mock('@renderer/lib/daemon', () => ({
  daemonBaseUrl: (): string => 'http://127.0.0.1:43118',
  daemonToken: (): string => '',
  setBrowserDaemonToken: vi.fn(),
}))

vi.mock('@renderer/lib/trpc', () => ({
  trpcClient: {
    recentRepos: { query: vi.fn() },
  },
}))

const GRANT = `pc_pair_3f2a1c88-0f4d-4b6e-9a11-2c7d5e8b0a34_${'a'.repeat(64)}`

describe('useTokenGate pairing request', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    // restoreAllMocks does NOT undo stubGlobal, so a stubbed fetch used to leak into the
    // next case and answer requests that test never made.
    vi.unstubAllGlobals()
    // Nor does it clear a persistent `mockRejectedValue` on a factory-created vi.fn — the
    // next case then probes against the previous case's failure.
    vi.mocked(trpcClient.recentRepos.query).mockReset()
    window.history.replaceState(null, '', '/')
  })

  it('sends the shared protocol header on the pairing POST without changing it', async () => {
    let requestUrl = ''
    let request: RequestInit | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        requestUrl = String(input)
        request = init
        return new Response(JSON.stringify({ token: 'pc_client_web' }), { status: 200 })
      }),
    )
    window.history.replaceState(null, '', `/pair#token=${GRANT}`)

    const hook = renderHook(() => useTokenGate())
    await waitFor(() => {
      expect(hook.result.current.status).toBe('open')
    })

    const init = request
    if (init === undefined) throw new Error('the gate made no pairing request')
    expect(requestUrl).toBe('/pair')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ credential: GRANT }))
    const headers = new Headers(init.headers)
    expect(headers.get(PROTOCOL_VERSION_HEADER)).toBe(String(PROTOCOL_VERSION))
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('authorization')).toBeNull()
  })

  it('locks when the probe fails and the daemon serves no dev credential', async () => {
    // Production: /dev-auth does not exist, so the gate lands on the pairing form exactly
    // as it did before development auto-authorization was added.
    const fetchMock = vi.fn(async () => new Response('', { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.mocked(trpcClient.recentRepos.query).mockRejectedValue(new Error('UNAUTHORIZED'))
    window.history.replaceState(null, '', '/')

    const hook = renderHook(() => useTokenGate())
    await waitFor(() => {
      expect(hook.result.current.status).toBe('locked')
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/dev-auth')
  })

  it('never leaves the gate showing the form while the dev credential is in flight', async () => {
    let release: (value: Response) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Promise<Response>((resolve) => (release = resolve))),
    )
    vi.mocked(trpcClient.recentRepos.query).mockRejectedValueOnce(new Error('UNAUTHORIZED'))
    window.history.replaceState(null, '', '/')

    const hook = renderHook(() => useTokenGate())
    await waitFor(() => {
      expect(trpcClient.recentRepos.query).toHaveBeenCalledTimes(1)
    })
    // A flash of the pairing form is the interruption auto-auth exists to remove.
    expect(hook.result.current.status).toBe('checking')

    release(new Response(JSON.stringify({ token: 'pc_client_dev' }), { status: 200 }))
    await waitFor(() => {
      expect(hook.result.current.status).toBe('open')
    })
  })

  it('adopts the dev credential and re-probes with it, healing a stale stored token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ token: 'pc_client_dev' }), { status: 200 })),
    )
    // The first probe fails the way a revoked or rotated localStorage token fails.
    vi.mocked(trpcClient.recentRepos.query).mockRejectedValueOnce(new Error('UNAUTHORIZED'))
    window.history.replaceState(null, '', '/')

    const hook = renderHook(() => useTokenGate())
    await waitFor(() => {
      expect(hook.result.current.status).toBe('open')
    })
    expect(vi.mocked(setBrowserDaemonToken)).toHaveBeenCalledWith('pc_client_dev')
    expect(trpcClient.recentRepos.query).toHaveBeenCalledTimes(2)
  })

  it('stays locked when the dev credential itself does not authenticate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ token: 'pc_client_dev' }), { status: 200 })),
    )
    vi.mocked(trpcClient.recentRepos.query).mockRejectedValue(new Error('UNAUTHORIZED'))
    window.history.replaceState(null, '', '/')

    const hook = renderHook(() => useTokenGate())
    await waitFor(() => {
      expect(hook.result.current.status).toBe('locked')
    })
  })
})
