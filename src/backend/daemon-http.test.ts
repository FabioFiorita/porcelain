// @vitest-environment node
import { createHash } from 'node:crypto'
import { mkdtemp } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import WebSocket from 'ws'

// The session and the router statically import terminal-manager, which imports
// node-pty — a native module built for Electron's ABI that won't load under
// plain-Node Vitest. Mock it (hoisted) so the import graph never touches it. The
// full export set mirrors what session.ts and api.ts import.
vi.mock('./terminal-manager', () => ({
  listTerminals: () => [],
  renameTerminal: vi.fn(),
  createTerminal: vi.fn(() => 'term-1'),
  attachTerminal: vi.fn(() => ({ scrollback: '', status: 'running' as const })),
  detachTerminal: vi.fn(),
  detachSender: vi.fn(),
  killTerminal: vi.fn(),
  writeTerminal: vi.fn(),
  resizeTerminal: vi.fn(),
}))

import { router } from './api'
import { initConfigDir } from './config-store'
import { createDaemonHttp } from './daemon-http'
import { cancelPairing, pendingPairing, redeemPairing, startPairing } from './pairing'
import { closeAllSessions, createSession, sessionCount } from './session'
import { attachTerminal } from './terminal-manager'
import { bindAuthToken, currentAuthToken } from './token-control'

const TOKEN = 'test-token'
const ORIGIN = 'http://localhost:5173'

let base: string
let daemon: ReturnType<typeof createDaemonHttp>

beforeAll(async () => {
  const dir = await mkdtemp(join(tmpdir(), 'porcelain-daemon-http-'))
  initConfigDir(dir)
  const tokenHash = createHash('sha256').update(TOKEN).digest()
  daemon = createDaemonHttp({
    tokenHash,
    allowedOrigin: ORIGIN,
    router,
    onSession: createSession,
    serveStatic: async (_req, res) => {
      res.writeHead(404)
      res.end()
    },
    // The real pairing module, so the endpoint tests exercise the actual guards
    // (404-at-rest, single-use, attempt burn) rather than a stub's idea of them.
    pairing: {
      hasPending: () => pendingPairing() !== null,
      redeem: async (code) => {
        const result = redeemPairing(code)
        if (result !== 'ok') return { result }
        return { result, token: currentAuthToken() }
      },
    },
  })
  bindAuthToken(TOKEN, daemon.setTokenHash)
  await new Promise<void>((resolve) => daemon.server.listen(0, '127.0.0.1', resolve))
  const address = daemon.server.address() as AddressInfo
  base = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    daemon.server.close((err) => (err ? reject(err) : resolve())),
  )
})

describe('daemon http surface — the token gate + CORS scope', () => {
  it('rejects /trpc with no auth header (401)', async () => {
    const res = await fetch(`${base}/trpc/recentRepos`)
    expect(res.status).toBe(401)
  })

  it('rejects /trpc with a wrong Bearer token (401)', async () => {
    const res = await fetch(`${base}/trpc/recentRepos`, {
      headers: { authorization: 'Bearer wrong-token' },
    })
    expect(res.status).toBe(401)
  })

  it('accepts /trpc with the right Bearer token', async () => {
    const res = await fetch(`${base}/trpc/recentRepos`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    })
    expect(res.status).toBe(200)
  })

  it('echoes CORS for the allowed origin and never *', async () => {
    const res = await fetch(`${base}/trpc/recentRepos`, {
      headers: { authorization: `Bearer ${TOKEN}`, origin: ORIGIN },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(res.headers.get('access-control-allow-origin')).not.toBe('*')
  })

  it('does not echo CORS for an unlisted origin', async () => {
    const res = await fetch(`${base}/trpc/recentRepos`, {
      headers: { authorization: `Bearer ${TOKEN}`, origin: 'http://evil.example' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('answers OPTIONS preflight for /trpc without requiring a token', async () => {
    const res = await fetch(`${base}/trpc/recentRepos`, {
      method: 'OPTIONS',
      headers: { origin: ORIGIN },
    })
    expect(res.status).toBe(204)
  })

  it('rejects a rotated-away token after setTokenHash', async () => {
    const next = 'rotated-token'
    daemon.setTokenHash(createHash('sha256').update(next).digest())
    const denied = await fetch(`${base}/trpc/recentRepos`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    })
    expect(denied.status).toBe(401)
    // Restore the suite's shared token so later tests keep working.
    daemon.setTokenHash(createHash('sha256').update(TOKEN).digest())
    bindAuthToken(TOKEN, daemon.setTokenHash)
    const ok = await fetch(`${base}/trpc/recentRepos`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    })
    expect(ok.status).toBe(200)
  })
})

// Open a WS and wait for the handshake to settle (open or fail).
function connect(protocols?: string | string[]): Promise<WebSocket> {
  const url = `${base.replace('http', 'ws')}/session`
  return new Promise((resolve, reject) => {
    const ws = protocols === undefined ? new WebSocket(url) : new WebSocket(url, protocols)
    const timer = setTimeout(() => reject(new Error('ws connect timed out')), 4000)
    ws.on('open', () => {
      clearTimeout(timer)
      resolve(ws)
    })
    ws.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    ws.on('unexpected-response', () => {
      clearTimeout(timer)
      reject(new Error('unexpected-response'))
    })
  })
}

// The next server message as parsed JSON.
function nextMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.once('message', (raw: Buffer) => resolve(JSON.parse(raw.toString())))
  })
}

describe('daemon ws surface — the /session upgrade gate + dispatch', () => {
  it('rejects a /session upgrade with no subprotocol', async () => {
    await expect(connect()).rejects.toBeDefined()
  })

  it('rejects a /session upgrade with a wrong-token subprotocol', async () => {
    await expect(connect('porcelain.wrong-token')).rejects.toBeDefined()
  })

  it('closes every live socket on closeAllSessions — the gate only runs at upgrade time', async () => {
    const ws = await connect(`porcelain.${TOKEN}`)
    expect(sessionCount()).toBeGreaterThanOrEqual(1)
    closeAllSessions()
    await vi.waitFor(() => expect(ws.readyState).not.toBe(WebSocket.OPEN))
    await vi.waitFor(() => expect(sessionCount()).toBe(0))
  })

  it('rejects the right subprotocol on the wrong path', async () => {
    const ws = new WebSocket(`${base.replace('http', 'ws')}/nope`, `porcelain.${TOKEN}`)
    await expect(
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timed out')), 4000)
        ws.on('open', () => {
          clearTimeout(timer)
          resolve()
        })
        ws.on('error', () => {
          clearTimeout(timer)
          reject(new Error('rejected'))
        })
      }),
    ).rejects.toBeDefined()
  })

  it('accepts the right subprotocol and answers terminal:create', async () => {
    const ws = await connect(`porcelain.${TOKEN}`)
    const reply = nextMessage(ws)
    ws.send(JSON.stringify({ t: 'terminal:create', reqId: 'r1', name: 't', cwd: '/tmp' }))
    expect(await reply).toEqual({ t: 'terminal:created', reqId: 'r1', id: 'term-1' })
    ws.close()
  })

  it('replies found:false for an unknown terminal:attach id', async () => {
    vi.mocked(attachTerminal).mockReturnValueOnce(null)
    const ws = await connect(`porcelain.${TOKEN}`)
    const reply = nextMessage(ws)
    ws.send(JSON.stringify({ t: 'terminal:attach', reqId: 'r2', id: 'ghost' }))
    expect(await reply).toMatchObject({
      t: 'terminal:attached',
      reqId: 'r2',
      id: 'ghost',
      found: false,
      status: 'exited',
    })
    ws.close()
  })

  it('drops malformed input without closing the socket', async () => {
    const ws = await connect(`porcelain.${TOKEN}`)
    ws.send('}{ not json')
    const reply = nextMessage(ws)
    ws.send(JSON.stringify({ t: 'terminal:create', reqId: 'r3', name: 't', cwd: '/tmp' }))
    expect(await reply).toEqual({ t: 'terminal:created', reqId: 'r3', id: 'term-1' })
    ws.close()
  })
})

/**
 * `POST /pair` is the daemon's ONE unauthenticated dynamic route, so its guards are
 * the tests that matter most in this file: it must not exist at rest, must refuse
 * anything that isn't a JSON POST (the preflight lever that keeps drive-by web content
 * out), and must never hand the token to a wrong or replayed code.
 */
describe('POST /pair', () => {
  const post = (body: unknown, init?: RequestInit): Promise<Response> =>
    fetch(`${base}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      ...init,
    })

  afterEach(() => cancelPairing())

  it('does not exist while nobody is pairing — nothing to probe at rest', async () => {
    const res = await post({ code: 'ANYT-HING' })
    expect(res.status).toBe(404)
  })

  it('hands out the shared token — one secret for every client', async () => {
    const { code } = startPairing()
    const res = await post({ code, label: 'iPad' })
    expect(res.status).toBe(200)
    const { token } = (await res.json()) as { token: string }
    expect(token).toBe(TOKEN)
    const authed = await fetch(`${base}/trpc/recentRepos`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(authed.status).toBe(200)
  })

  it('accepts the code as the human retyped it (no separator, lower case)', async () => {
    const { code } = startPairing()
    const res = await post({ code: code.replace('-', '').toLowerCase() })
    expect(res.status).toBe(200)
  })

  it('refuses a wrong code without leaking the token', async () => {
    startPairing()
    const res = await post({ code: 'WRON-GWRO' })
    expect(res.status).toBe(401)
    expect(await res.text()).not.toContain(TOKEN)
  })

  it('is single-use — the same code cannot be replayed', async () => {
    const { code } = startPairing()
    expect((await post({ code })).status).toBe(200)
    // The window closed with the redemption, so the route is gone again.
    expect((await post({ code })).status).toBe(404)
  })

  it('rejects a non-JSON content type, so a cross-origin POST must preflight', async () => {
    const { code } = startPairing()
    const res = await fetch(`${base}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ code }),
    })
    expect(res.status).toBe(415)
  })

  it('rejects a non-POST method', async () => {
    startPairing()
    const res = await fetch(`${base}/pair`, { method: 'GET' })
    expect(res.status).toBe(405)
  })

  it('rejects a body that is not a pairing exchange', async () => {
    startPairing()
    expect((await post({ code: 42 })).status).toBe(400)
  })

  it('rejects an oversized body instead of buffering it', async () => {
    startPairing()
    const res = await post({ code: 'x'.repeat(4096) })
    expect(res.status).toBe(413)
  })

  it('does not echo the allowed origin to an unlisted one', async () => {
    startPairing()
    const res = await post(
      { code: 'WRON-GWRO' },
      { headers: { 'content-type': 'application/json', origin: 'http://evil.example' } },
    )
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })
})
