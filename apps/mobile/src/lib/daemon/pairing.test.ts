import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { parsePairingLink, redeemPairingLink } from './pairing'

const GRANT = `pc_pair_3f2a1c88-0f4d-4b6e-9a11-2c7d5e8b0a34_${'a'.repeat(64)}`

describe('parsePairingLink', () => {
  it('reads the origin and the grant out of a desktop pairing link', () => {
    const parsed = parsePairingLink(`http://beelink.local:43117/pair#token=${GRANT}`)

    expect(parsed).toEqual({
      ok: true,
      link: { baseUrl: 'http://beelink.local:43117', credential: GRANT },
    })
  })

  it('keeps the port and scheme the daemon was reached on', () => {
    const parsed = parsePairingLink(`https://box.tail1234.ts.net/pair#token=${GRANT}`)

    expect(parsed).toEqual({
      ok: true,
      link: { baseUrl: 'https://box.tail1234.ts.net', credential: GRANT },
    })
  })

  it('tolerates the whitespace a paste from another device brings with it', () => {
    const parsed = parsePairingLink(`  http://192.168.1.20:43117/pair#token=${GRANT}\n`)

    expect(parsed).toEqual({
      ok: true,
      link: { baseUrl: 'http://192.168.1.20:43117', credential: GRANT },
    })
  })

  // RN's URL shim reads the fragment with /#([^/]*)/, which truncates at a slash. Parsing by
  // hand is only worth it if it survives the cases that shim would drop.
  it('reads a token that follows another fragment parameter', () => {
    const parsed = parsePairingLink(`http://host:43117/pair#from=desktop&token=${GRANT}`)

    expect(parsed).toEqual({ ok: true, link: { baseUrl: 'http://host:43117', credential: GRANT } })
  })

  it('rejects an empty paste', () => {
    expect(parsePairingLink('   ')).toEqual({ ok: false, problem: 'empty' })
  })

  const malformed: readonly [string, string][] = [
    ['not a url at all', 'beelink.local:43117'],
    ['a non-http scheme', `porcelain://pair#token=${GRANT}`],
    ['no fragment', 'http://beelink.local:43117/pair'],
    // Userinfo would store the attacker's origin under a trusted-looking host, and the
    // session that redeems grants would POST one there.
    ['userinfo hiding the real host', `http://beelink.local@evil.example/pair#token=${GRANT}`],
    ['a second fragment extending the token', `http://host:43117/pair#token=${GRANT}#extra`],
  ]

  it.each(malformed)('rejects %s as malformed', (_label, input) => {
    expect(parsePairingLink(input)).toEqual({ ok: false, problem: 'malformed' })
  })

  it('rejects a token with a broken percent escape instead of throwing', () => {
    expect(parsePairingLink('http://beelink.local:43117/pair#token=pc_pair_100%off')).toEqual({
      ok: false,
      problem: 'missing-token',
    })
  })

  it('rejects a link whose fragment carries no token', () => {
    expect(parsePairingLink('http://beelink.local:43117/pair#from=desktop')).toEqual({
      ok: false,
      problem: 'missing-token',
    })
  })

  it('rejects an already-redeemed client token pasted in place of a grant', () => {
    const clientToken = `pc_client_3f2a1c88-0f4d-4b6e-9a11-2c7d5e8b0a34_${'b'.repeat(64)}`

    expect(parsePairingLink(`http://beelink.local:43117/pair#token=${clientToken}`)).toEqual({
      ok: false,
      problem: 'foreign-token',
    })
  })
})

/**
 * Pairing is the only request this app makes without a bearer token, which is exactly why it
 * must still declare the protocol: it is the first thing a phone says to a daemon. The header
 * rides alongside the existing request — same URL, same JSON body, same content type — because
 * a version declaration that altered the exchange would be a second pairing protocol.
 */
describe('redeemPairingLink', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends the shared protocol header without disturbing the pairing request', async () => {
    let requestUrl = ''
    let request: RequestInit | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        requestUrl = String(input)
        request = init
        return new Response(JSON.stringify({ token: 'pc_client_abc' }), { status: 200 })
      }),
    )

    const token = await redeemPairingLink({
      baseUrl: 'http://beelink.local:43117',
      credential: GRANT,
    })

    expect(token).toBe('pc_client_abc')
    const init = request
    if (init === undefined) throw new Error('pairing made no request')
    expect(requestUrl).toBe('http://beelink.local:43117/pair')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ credential: GRANT }))
    const headers = new Headers(init.headers)
    expect(headers.get(PROTOCOL_VERSION_HEADER)).toBe(String(PROTOCOL_VERSION))
    expect(headers.get('content-type')).toBe('application/json')
    // Redeeming a grant is unauthenticated by design; the header must not have added one.
    expect(headers.get('authorization')).toBeNull()
  })
})
