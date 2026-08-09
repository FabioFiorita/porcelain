// @vitest-environment node
import { createHash } from 'node:crypto'
import { mkdtemp } from 'node:fs/promises'
import { type IncomingMessage, request, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { publicErrorSchema } from '@porcelain/contracts'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import WebSocket from 'ws'

// The session and the router statically import terminal-manager, which imports
// node-pty — a native module built for Electron's ABI that won't load under
// plain-Node Vitest. Mock it (hoisted) so the import graph never touches it.
vi.mock('../terminal/terminal-manager', () => ({
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

import { router } from '../api'
import { initConfigDir } from '../stores/config-store'
import { attachTerminal } from '../terminal/terminal-manager'
import { createDaemonHttp, type DaemonHttpOptions } from './daemon-http'
import { closeAllSessions, closeClientSessions, createSession, sessionCount } from './session'

const TOKEN = 'test-token'
const CLIENT_TOKEN = 'client-token'
const PAIRING_TOKEN = 'pairing-token'
const ORIGIN = 'http://localhost:5173'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

let base: string
let daemon: ReturnType<typeof createDaemonHttp>

const authenticateTestClient: DaemonHttpOptions['authenticateClient'] = async (provided) =>
  provided === CLIENT_TOKEN ? { kind: 'client', clientId: 'client-1', label: 'Test phone' } : null

const exchangeTestPairing: DaemonHttpOptions['exchangePairing'] = async (provided) =>
  provided === PAIRING_TOKEN
    ? {
        token: CLIENT_TOKEN,
        client: {
          id: 'client-1',
          label: 'Test phone',
          createdAt: new Date(0).toISOString(),
        },
      }
    : null

function testDaemonOptions({
  authenticateClient = authenticateTestClient,
  exchangePairing = exchangeTestPairing,
}: Partial<
  Pick<DaemonHttpOptions, 'authenticateClient' | 'exchangePairing'>
> = {}): DaemonHttpOptions {
  return {
    adminTokenHash: createHash('sha256').update(TOKEN).digest(),
    authenticateClient,
    exchangePairing,
    allowedOrigin: ORIGIN,
    router,
    onSession: createSession,
    serveStatic: async (req: IncomingMessage, res: ServerResponse) => {
      res.writeHead(req.url === '/pair' ? 200 : 404)
      res.end()
    },
  }
}

async function startTestDaemon(
  options: Partial<Pick<DaemonHttpOptions, 'authenticateClient' | 'exchangePairing'>> = {},
): Promise<{ base: string; daemon: ReturnType<typeof createDaemonHttp> }> {
  const testDaemon = createDaemonHttp(testDaemonOptions(options))
  await new Promise<void>((resolve) => testDaemon.server.listen(0, '127.0.0.1', resolve))
  const address = testDaemon.server.address() as AddressInfo
  return { base: `http://127.0.0.1:${address.port}`, daemon: testDaemon }
}

async function stopTestDaemon(testDaemon: ReturnType<typeof createDaemonHttp>): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    testDaemon.server.close((error) => (error ? reject(error) : resolve())),
  )
}

async function trpcPublicErrorFrom(response: Response) {
  const body = (await response.json()) as {
    error: { message: string; data: { porcelain: unknown } }
  }
  return { message: body.error.message, error: publicErrorSchema.parse(body.error.data.porcelain) }
}

async function publicHttpErrorFrom(response: Response) {
  const contentLength = response.headers.get('content-length')
  const body = await response.text()
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
  expect(contentLength).toBe(String(Buffer.byteLength(body, 'utf8')))
  return publicErrorSchema.parse(JSON.parse(body))
}

async function expectPublicHttpFailure(response: Response, status: number, code: string) {
  expect(response.status).toBe(status)
  const error = await publicHttpErrorFrom(response)
  expect(error).toMatchObject({ code })
  expect(error.requestId).toMatch(UUID_PATTERN)
  return error
}

function postChunked(url: string, body: string): Promise<Response> {
  const target = new URL(url)
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: target.hostname,
        port: Number(target.port),
        path: target.pathname,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'transfer-encoding': 'chunked',
        },
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('end', () => {
          const headers = new Headers()
          for (const [name, value] of Object.entries(response.headers)) {
            if (value === undefined) continue
            if (Array.isArray(value)) {
              for (const entry of value) headers.append(name, entry)
            } else {
              headers.set(name, value)
            }
          }
          resolve(
            new Response(Buffer.concat(chunks), {
              status: response.statusCode ?? 500,
              headers,
            }),
          )
        })
      },
    )
    req.on('error', reject)
    const midpoint = Math.floor(body.length / 2)
    req.write(body.slice(0, midpoint))
    req.end(body.slice(midpoint))
  })
}

beforeAll(async () => {
  const dir = await mkdtemp(join(tmpdir(), 'porcelain-daemon-http-'))
  initConfigDir(dir)
  const started = await startTestDaemon()
  base = started.base
  daemon = started.daemon
})

afterAll(async () => {
  await stopTestDaemon(daemon)
})

describe('daemon http surface — the token gate + CORS scope', () => {
  it.each([
    ['a missing Bearer credential', {}],
    ['a wrong Bearer credential', { authorization: 'Bearer wrong-token' }],
  ])('returns a public unauthenticated error for %s', async (_label, authHeaders) => {
    const res = await fetch(`${base}/trpc/recentRepos`, {
      headers: { ...authHeaders, origin: ORIGIN },
    })
    await expectPublicHttpFailure(res, 401, 'auth.unauthenticated')
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN)
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
    expect(await res.text()).toBe('')
  })

  it('exchanges a valid one-time pairing credential without authentication', async () => {
    const res = await fetch(`${base}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential: PAIRING_TOKEN }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toMatchObject({ token: CLIENT_TOKEN })
  })

  it('serves the app shell for a pairing-link navigation', async () => {
    const res = await fetch(`${base}/pair`)
    expect(res.status).toBe(200)
  })

  it('returns a public unauthenticated error for an exhausted pairing grant', async () => {
    const exchangePairing = vi.fn(async (_credential: string) => null)
    const isolated = await startTestDaemon({ exchangePairing })

    try {
      const res = await fetch(`${isolated.base}/pair`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ credential: 'consumed-pairing-grant' }),
      })
      await expectPublicHttpFailure(res, 401, 'auth.unauthenticated')
      expect(exchangePairing).toHaveBeenCalledOnce()
    } finally {
      await stopTestDaemon(isolated.daemon)
    }
  })

  it.each([
    ['malformed JSON', '{"credential":'],
    ['a non-string credential', JSON.stringify({ credential: 42 })],
  ])('rejects pairing %s before grant exchange', async (_label, body) => {
    const exchangePairing = vi.fn(async (_credential: string) => null)
    const isolated = await startTestDaemon({ exchangePairing })

    try {
      const res = await fetch(`${isolated.base}/pair`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      })
      await expectPublicHttpFailure(res, 400, 'request.invalid')
      expect(exchangePairing).not.toHaveBeenCalled()
    } finally {
      await stopTestDaemon(isolated.daemon)
    }
  })

  it('rejects a declared pairing body above the cap before grant exchange', async () => {
    const exchangePairing = vi.fn(async (_credential: string) => null)
    const isolated = await startTestDaemon({ exchangePairing })

    try {
      const res = await fetch(`${isolated.base}/pair`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ credential: 'x'.repeat(8_192) }),
      })
      await expectPublicHttpFailure(res, 413, 'request.invalid')
      expect(exchangePairing).not.toHaveBeenCalled()
    } finally {
      await stopTestDaemon(isolated.daemon)
    }
  })

  it('rejects a streamed pairing body above the cap before grant exchange', async () => {
    const exchangePairing = vi.fn(async (_credential: string) => null)
    const isolated = await startTestDaemon({ exchangePairing })

    try {
      const res = await postChunked(
        `${isolated.base}/pair`,
        JSON.stringify({ credential: 'x'.repeat(8_192) }),
      )
      await expectPublicHttpFailure(res, 413, 'request.invalid')
      expect(exchangePairing).not.toHaveBeenCalled()
    } finally {
      await stopTestDaemon(isolated.daemon)
    }
  })

  it('rate limits pairing before grant exchange and preserves retry-after', async () => {
    const exchangePairing = vi.fn(async (_credential: string) => null)
    const isolated = await startTestDaemon({ exchangePairing })

    try {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const res = await fetch(`${isolated.base}/pair`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ credential: `pairing-attempt-${attempt}` }),
        })
        await expectPublicHttpFailure(res, 401, 'auth.unauthenticated')
      }

      const limited = await fetch(`${isolated.base}/pair`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ credential: 'rate-limited-pairing-attempt' }),
      })
      expect(limited.headers.get('retry-after')).toBe('60')
      await expectPublicHttpFailure(limited, 429, 'resource.unavailable')
      expect(exchangePairing).toHaveBeenCalledTimes(12)
    } finally {
      await stopTestDaemon(isolated.daemon)
    }
  })

  it('logs an unexpected authentication failure once without exposing raw details', async () => {
    const secret = 'token=authentication-secret path=/host/private content=never-send'
    const authenticateClient = vi.fn(async (_credential: string) => {
      throw new Error(secret)
    })
    const isolated = await startTestDaemon({ authenticateClient })
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      const res = await fetch(`${isolated.base}/trpc/recentRepos`, {
        headers: { authorization: 'Bearer unexpected-authentication-token' },
      })
      const error = await expectPublicHttpFailure(res, 500, 'internal.unexpected')

      expect(authenticateClient).toHaveBeenCalledOnce()
      expect(log).toHaveBeenCalledOnce()
      expect(log).toHaveBeenCalledWith({
        requestId: error.requestId,
        path: null,
        errorType: 'Error',
      })
      expect(JSON.stringify({ error, logs: log.mock.calls })).not.toContain(secret)
    } finally {
      log.mockRestore()
      await stopTestDaemon(isolated.daemon)
    }
  })

  it('logs an unexpected pairing failure once without exposing raw details', async () => {
    const secret = 'token=pairing-secret path=/host/private content=never-send'
    const exchangePairing = vi.fn(async (_credential: string) => {
      throw new Error(secret)
    })
    const isolated = await startTestDaemon({ exchangePairing })
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      const res = await fetch(`${isolated.base}/pair`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ credential: 'unexpected-pairing-grant' }),
      })
      const error = await expectPublicHttpFailure(res, 500, 'internal.unexpected')

      expect(exchangePairing).toHaveBeenCalledOnce()
      expect(log).toHaveBeenCalledOnce()
      expect(log).toHaveBeenCalledWith({
        requestId: error.requestId,
        path: null,
        errorType: 'Error',
      })
      expect(JSON.stringify({ error, logs: log.mock.calls })).not.toContain(secret)
    } finally {
      log.mockRestore()
      await stopTestDaemon(isolated.daemon)
    }
  })

  it('accepts a client token for ordinary procedures', async () => {
    const ok = await fetch(`${base}/trpc/recentRepos`, {
      headers: { authorization: `Bearer ${CLIENT_TOKEN}` },
    })
    expect(ok.status).toBe(200)
  })

  it('forbids a client token from access administration', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      const forbidden = await fetch(`${base}/trpc/accessStatus`, {
        headers: { authorization: `Bearer ${CLIENT_TOKEN}` },
      })
      expect(forbidden.status).toBe(403)
      const publicError = await trpcPublicErrorFrom(forbidden)
      expect(publicError.message).toBe('Access is forbidden.')
      expect(publicError.error).toMatchObject({ code: 'auth.forbidden' })
      expect(publicError.error.requestId).toMatch(UUID_PATTERN)
      expect(log).not.toHaveBeenCalled()
    } finally {
      log.mockRestore()
    }
  })

  it('maps malformed tRPC input to request.invalid without error logging', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      const invalid = await fetch(`${base}/trpc/issuePairingLink`, {
        method: 'POST',
        headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ label: '', baseUrl: 'not a URL' }),
      })
      expect(invalid.status).toBe(400)
      expect((await trpcPublicErrorFrom(invalid)).error).toMatchObject({ code: 'request.invalid' })
      expect(log).not.toHaveBeenCalled()
    } finally {
      log.mockRestore()
    }
  })

  it('logs unexpected router failures once without exposing their raw details', async () => {
    const secret = 'token=secret-path-content-never-send'
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      const unexpected = await fetch(`${base}/trpc/renamePath`, {
        method: 'POST',
        headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: `/private/${secret}/from.txt`,
          to: `/private/${secret}/to.txt`,
        }),
      })
      expect(unexpected.status).toBe(500)
      const publicError = await trpcPublicErrorFrom(unexpected)

      expect(publicError.error).toMatchObject({ code: 'internal.unexpected' })
      expect(log).toHaveBeenCalledOnce()
      expect(log).toHaveBeenCalledWith({
        requestId: publicError.error.requestId,
        path: 'renamePath',
        errorType: 'Error',
      })
      expect(JSON.stringify({ publicError, logs: log.mock.calls })).not.toContain(secret)
    } finally {
      log.mockRestore()
    }
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

  it('closes only sockets belonging to a revoked client', async () => {
    const client = await connect(`porcelain.${CLIENT_TOKEN}`)
    const admin = await connect(`porcelain.${TOKEN}`)

    closeClientSessions('client-1')

    await vi.waitFor(() => expect(client.readyState).not.toBe(WebSocket.OPEN))
    expect(admin.readyState).toBe(WebSocket.OPEN)
    admin.close()
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
