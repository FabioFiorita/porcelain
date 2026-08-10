import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useTokenGate } from './use-token-gate'

// The gate only stores the redeemed token; the transport's getters are stubbed so importing
// lib/trpc never opens a session in jsdom.
vi.mock('@renderer/lib/daemon', () => ({
  daemonBaseUrl: (): string => 'http://127.0.0.1:43118',
  daemonToken: (): string => '',
  setBrowserDaemonToken: vi.fn(),
}))

const GRANT = `pc_pair_3f2a1c88-0f4d-4b6e-9a11-2c7d5e8b0a34_${'a'.repeat(64)}`

/**
 * `/pair` is the browser client's one unauthenticated request, and the only one the gate
 * makes before a token exists. It must still declare the protocol: the daemon reads the
 * version off the request envelope, so a versionless pairing POST is indistinguishable from
 * a client too old to pair. The rest of the exchange — path, method, JSON body, content
 * type — is what the daemon already accepts and must not move.
 */
describe('useTokenGate pairing request', () => {
  afterEach(() => {
    vi.restoreAllMocks()
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
    // Redeeming the grant is how a token is obtained; it must not require one.
    expect(headers.get('authorization')).toBeNull()
  })
})
