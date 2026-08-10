import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAppClientFor } from './trpc'

/**
 * The appRouter link is the client's only daemon transport, so this is where the protocol
 * version has to ride. The link already carries the session token and rebases the placeholder
 * host onto the live daemon per request; adding a version must leave both untouched — a
 * request that gained a version and lost its bearer token would 401 instead of connecting.
 */
describe('appRouter transport headers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends the protocol version with the session token on a tRPC call', async () => {
    let requestUrl = ''
    let request: RequestInit | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        requestUrl = String(input)
        request = init
        return new Response(JSON.stringify([{ result: { data: { ok: true } } }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    )

    const client = createAppClientFor({
      baseUrl: () => 'http://127.0.0.1:43118',
      token: () => 'pc_client_web',
    })
    await client.setRepoNotes.mutate({ repoPath: '/synthetic/repo', notes: 'hi' })

    const init = request
    if (init === undefined) throw new Error('the transport made no request')
    // Rebased onto the live daemon, not left on the placeholder host.
    expect(requestUrl).toContain('http://127.0.0.1:43118/trpc/setRepoNotes')
    expect(requestUrl).not.toContain('daemon.invalid')
    expect(init.method).toBe('POST')
    expect(String(init.body)).toContain('"notes":"hi"')
    const headers = new Headers(init.headers)
    expect(headers.get(PROTOCOL_VERSION_HEADER)).toBe(String(PROTOCOL_VERSION))
    expect(headers.get('authorization')).toBe('Bearer pc_client_web')
  })
})
