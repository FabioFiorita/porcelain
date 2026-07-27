// @vitest-environment node
import { createHash } from 'node:crypto'
import { mkdtemp } from 'node:fs/promises'
import { type AddressInfo, createServer as createNetServer } from 'node:net'
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
import { createSession } from './session'
import { createIfaceListener, initIfaceHandlers } from './tailnet-listener'
import { attachTerminal } from './terminal-manager'

const TOKEN = 'test-token'
const ORIGIN = 'http://localhost:5173'

// Bind a throwaway server on port 0 to learn a free port, then release it — so
// the second-listener test owns its port instead of racing a live daemon on the
// production LISTENER_PORT.
function freePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const probe = createNetServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo
      probe.close(() => resolve(port))
    })
  })
}

let base: string
let daemon: ReturnType<typeof createDaemonHttp>

beforeAll(async () => {
  initConfigDir(await mkdtemp(join(tmpdir(), 'porcelain-daemon-http-')))
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
      redeem: (code) => {
        const result = redeemPairing(code)
        return result === 'ok' ? { result, token: TOKEN } : { result }
      },
    },
  })
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

  it('rejects /trpc with a wrong bearer token (401)', async () => {
    const res = await fetch(`${base}/trpc/recentRepos`, {
      headers: { authorization: 'Bearer wrong' },
    })
    expect(res.status).toBe(401)
  })

  it('rejects /trpc with an empty bearer token (401)', async () => {
    const res = await fetch(`${base}/trpc/recentRepos`, {
      headers: { authorization: 'Bearer ' },
    })
    expect(res.status).toBe(401)
  })

  it('accepts /trpc with the correct bearer token (200, tRPC-shaped body)', async () => {
    const res = await fetch(`${base}/trpc/recentRepos`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { result: { data: unknown } }
    // recentRepos returns [] against the fresh config dir.
    expect(body.result.data).toEqual([])
  })

  it('answers an OPTIONS preflight from the allowed origin (204 + echoed ACAO)', async () => {
    const res = await fetch(`${base}/trpc/whatever`, {
      method: 'OPTIONS',
      headers: { origin: ORIGIN },
    })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN)
  })

  it('does NOT echo CORS to a disallowed origin (and still 401s without a token)', async () => {
    const res = await fetch(`${base}/trpc/recentRepos`, {
      headers: { origin: 'https://evil.example' },
    })
    expect(res.status).toBe(401)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('echoes CORS to the file:// renderer (origin: null)', async () => {
    const res = await fetch(`${base}/trpc/whatever`, {
      method: 'OPTIONS',
      headers: { origin: 'null' },
    })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('null')
  })

  it('serves non-/trpc GET via the injected static handler, unauthenticated (404 here)', async () => {
    const res = await fetch(`${base}/`)
    expect(res.status).toBe(404)
  })

  it('404s a non-GET request to a non-/trpc path (only GET/HEAD reach static)', async () => {
    const res = await fetch(`${base}/anything-not-trpc`, { method: 'POST' })
    expect(res.status).toBe(404)
  })
})

describe('second-listener factory — the tailnet/LAN listeners share the token gate', () => {
  it('serves /trpc token-gated on a second bound address (401 without token, 200 with)', async () => {
    // The LAN and tailnet listeners are two instances of createIfaceListener sharing
    // server.ts's request/upgrade handlers. Boot one on loopback (a distinct socket
    // from the main harness daemon: same 127.0.0.1, an ephemeral port THIS test owns
    // rather than the production fixed port a live daemon may hold) and prove the
    // token gate applies to it exactly as it does to the primary listener.
    initIfaceHandlers(daemon.requestListener, daemon.handleUpgrade)
    const port = await freePort()
    const listener = createIfaceListener(
      () => ['127.0.0.1'],
      (addresses) => (addresses[0] !== undefined ? `http://${addresses[0]}:${port}` : null),
      'test',
      0,
      port,
    )
    const url = await listener.start()
    expect(url).toBe(`http://127.0.0.1:${port}`)
    try {
      const noAuth = await fetch(`http://127.0.0.1:${port}/trpc/recentRepos`)
      expect(noAuth.status).toBe(401)
      const withAuth = await fetch(`http://127.0.0.1:${port}/trpc/recentRepos`, {
        headers: { authorization: `Bearer ${TOKEN}` },
      })
      expect(withAuth.status).toBe(200)
    } finally {
      await listener.stop()
    }
    // stop() releases the socket — url() is null again and a restart is possible.
    expect(listener.url()).toBeNull()
  })
})

// Connect a ws client; resolve 'open' or reject on the first failure signal.
function connect(protocols?: string | string[]): Promise<WebSocket> {
  return new Promise<WebSocket>((resolve, reject) => {
    const url = `${base.replace('http', 'ws')}/session`
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

  it('hands over the token for the pending code', async () => {
    const { code } = startPairing()
    const res = await post({ code })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ token: TOKEN })
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
