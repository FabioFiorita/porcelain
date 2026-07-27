// @vitest-environment node
import { createHash } from 'node:crypto'
import { mkdtemp } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import WebSocket from 'ws'

// The session and the router statically import terminal-manager, which imports
// node-pty — a native module built for Electron's ABI that won't load under
// plain-Node Vitest. Mock it (hoisted) so the import graph never touches it.
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
import { closeAllSessions, createSession, sessionCount } from './session'
import { attachTerminal } from './terminal-manager'
import { bindAuthToken } from './token-control'

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

  it('has no unauthenticated /pair route — connect is URL + token only', async () => {
    const res = await fetch(`${base}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'ANYT-HING' }),
    })
    expect(res.status).toBe(404)
  })

  it('rejects a rotated-away token after setTokenHash', async () => {
    const next = 'rotated-token'
    daemon.setTokenHash(createHash('sha256').update(next).digest())
    const denied = await fetch(`${base}/trpc/recentRepos`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    })
    expect(denied.status).toBe(401)
    daemon.setTokenHash(createHash('sha256').update(TOKEN).digest())
    bindAuthToken(TOKEN, daemon.setTokenHash)
    const ok = await fetch(`${base}/trpc/recentRepos`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    })
    expect(ok.status).toBe(200)
  })
})

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

  it('closes every live socket on closeAllSessions', async () => {
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
