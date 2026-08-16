import { afterEach, describe, expect, it, vi } from 'vitest'

import { daemonInfoSchema, trpcShellRequestSchema, trpcShellResponseSchema } from './bridge'

/**
 * The preload runs at document-start, before the renderer document's CSP
 * (`script-src 'self' 'wasm-unsafe-eval'`) is in force — so Zod's one-shot "may I eval?"
 * probe answers yes and arms the `new Function` fast path for every schema built here.
 * By the time a shuttle reply is actually parsed the CSP IS in force, the fast path
 * throws `EvalError: Code generation from strings disallowed for this context`, and every
 * shell-router call in the renderer dies with it. `bridge.ts` opts out with
 * `z.config({ jitless: true })`; these tests are what keeps it there.
 *
 * Standing in for the CSP: a `Function` global that throws the way Chromium's does. If a
 * schema below ever reaches for code generation, it reaches for THIS.
 */
function blockedFunction(): never {
  throw new EvalError('Code generation from strings disallowed for this context')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('preload bridge schemas under a no-eval CSP', () => {
  it('parses a shuttle response without generating code', () => {
    vi.stubGlobal('Function', blockedFunction)

    const parsed = trpcShellResponseSchema.safeParse({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: '{"result":{"data":null}}',
    })

    expect(parsed.success).toBe(true)
    expect(parsed.data?.status).toBe(200)
  })

  it('parses a shuttle request without generating code', () => {
    vi.stubGlobal('Function', blockedFunction)

    const parsed = trpcShellRequestSchema.safeParse({
      url: 'http://localhost/trpc-shell/windowInit',
      method: 'GET',
      headers: {},
    })

    expect(parsed.success).toBe(true)
    expect(parsed.data?.method).toBe('GET')
  })

  it('parses the daemon pair without generating code', () => {
    vi.stubGlobal('Function', blockedFunction)

    const parsed = daemonInfoSchema.safeParse({ url: 'http://127.0.0.1:43117', token: 'pc_x' })

    expect(parsed.success).toBe(true)
    expect(parsed.data?.url).toBe('http://127.0.0.1:43117')
  })

  it('still rejects a malformed response with eval unavailable', () => {
    vi.stubGlobal('Function', blockedFunction)

    const parsed = trpcShellResponseSchema.safeParse({ status: 600, headers: {}, body: '' })

    expect(parsed.success).toBe(false)
  })
})
