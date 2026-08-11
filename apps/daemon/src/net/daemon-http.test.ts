// @vitest-environment node
import { createHash } from 'node:crypto'
import { mkdtemp } from 'node:fs/promises'
import { type IncomingMessage, request, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER, publicErrorSchema } from '@porcelain/contracts'
import { initTRPC } from '@trpc/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import WebSocket from 'ws'

import { createDaemonOperations, createDaemonRouter } from '../api'
import type { TerminalOperations } from '../features/terminal'
import {
  closeAllSessions,
  closeClientSessions,
  createSession,
  sessionCount,
} from '../session/live-session'
import { initConfigDir } from '../stores/config-store'
import { createDaemonHttp, type DaemonHttpOptions } from './daemon-http'

const terminalOperations: TerminalOperations = {
  create: vi.fn(() => ({ ok: true, value: 'term-1' })),
  attach: vi.fn((id) => ({
    ok: false,
    error: { code: id === 'ghost' ? 'terminal.not-found' : 'terminal.exited' },
  })),
  detach: vi.fn(() => ({ ok: true, value: undefined })),
  write: vi.fn(() => ({ ok: true, value: undefined })),
  resize: vi.fn(() => ({ ok: true, value: undefined })),
  kill: vi.fn(() => ({ ok: true, value: undefined })),
  pasteImage: vi.fn(async () => ({ ok: true, value: { result: 'ok' } })),
  pasteFile: vi.fn(async () => ({ ok: true, value: { result: 'ok' } })),
  list: vi.fn(() => []),
  rename: vi.fn(),
  detachSink: vi.fn(),
  sweep: vi.fn(),
}

const router = createDaemonRouter({
  operations: createDaemonOperations({ terminal: terminalOperations }),
})

const TOKEN = 'test-token'
const CLIENT_TOKEN = 'client-token'
const PAIRING_TOKEN = 'pairing-token'
const ORIGIN = 'http://localhost:5173'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** What every repository-owned caller announces; the daemon accepts nothing else. */
const PROTOCOL_HEADERS: Record<string, string> = {
  [PROTOCOL_VERSION_HEADER]: String(PROTOCOL_VERSION),
}

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

type TestDaemonOverrides = Partial<
  Pick<DaemonHttpOptions, 'authenticateClient' | 'exchangePairing' | 'router'>
>

function testDaemonOptions({
  authenticateClient = authenticateTestClient,
  exchangePairing = exchangeTestPairing,
  router: testRouter = router,
}: TestDaemonOverrides = {}): DaemonHttpOptions {
  return {
    adminTokenHash: createHash('sha256').update(TOKEN).digest(),
    authenticateClient,
    exchangePairing,
    allowedOrigin: ORIGIN,
    router: testRouter,
    onSession: (socket, identity) => createSession(socket, identity, terminalOperations),
    serveStatic: async (req: IncomingMessage, res: ServerResponse) => {
      res.writeHead(req.url === '/pair' ? 200 : 404)
      res.end()
    },
  }
}

async function startTestDaemon(
  options: TestDaemonOverrides = {},
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
          ...PROTOCOL_HEADERS,
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
      headers: { ...authHeaders, origin: ORIGIN, ...PROTOCOL_HEADERS },
    })
    await expectPublicHttpFailure(res, 401, 'auth.unauthenticated')
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN)
  })

  it('accepts /trpc with the right Bearer token', async () => {
    const res = await fetch(`${base}/trpc/recentRepos`, {
      headers: { authorization: `Bearer ${TOKEN}`, ...PROTOCOL_HEADERS },
    })
    expect(res.status).toBe(200)
  })

  it('echoes CORS for the allowed origin and never *', async () => {
    const res = await fetch(`${base}/trpc/recentRepos`, {
      headers: { authorization: `Bearer ${TOKEN}`, origin: ORIGIN, ...PROTOCOL_HEADERS },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(res.headers.get('access-control-allow-origin')).not.toBe('*')
  })

  it('does not echo CORS for an unlisted origin', async () => {
    const res = await fetch(`${base}/trpc/recentRepos`, {
      headers: {
        authorization: `Bearer ${TOKEN}`,
        origin: 'http://evil.example',
        ...PROTOCOL_HEADERS,
      },
    })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('answers OPTIONS preflight for /trpc without requiring a token', async () => {
    const res = await fetch(`${base}/trpc/recentRepos`, {
      method: 'OPTIONS',
      headers: {
        origin: ORIGIN,
        'access-control-request-headers': `authorization,content-type,${PROTOCOL_VERSION_HEADER}`,
      },
    })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-headers')?.split(',')).toEqual([
      'content-type',
      'authorization',
      PROTOCOL_VERSION_HEADER,
    ])
    expect(await res.text()).toBe('')
  })

  it('exchanges a valid one-time pairing credential without authentication', async () => {
    const res = await fetch(`${base}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...PROTOCOL_HEADERS },
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
        headers: { 'content-type': 'application/json', ...PROTOCOL_HEADERS },
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
        headers: { 'content-type': 'application/json', ...PROTOCOL_HEADERS },
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
        headers: { 'content-type': 'application/json', ...PROTOCOL_HEADERS },
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
          headers: { 'content-type': 'application/json', ...PROTOCOL_HEADERS },
          body: JSON.stringify({ credential: `pairing-attempt-${attempt}` }),
        })
        await expectPublicHttpFailure(res, 401, 'auth.unauthenticated')
      }

      const limited = await fetch(`${isolated.base}/pair`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...PROTOCOL_HEADERS },
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
        headers: { authorization: 'Bearer unexpected-authentication-token', ...PROTOCOL_HEADERS },
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
        headers: { 'content-type': 'application/json', ...PROTOCOL_HEADERS },
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
      headers: { authorization: `Bearer ${CLIENT_TOKEN}`, ...PROTOCOL_HEADERS },
    })
    expect(ok.status).toBe(200)
  })

  it('forbids a client token from access administration', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      const forbidden = await fetch(`${base}/trpc/accessStatus`, {
        headers: { authorization: `Bearer ${CLIENT_TOKEN}`, ...PROTOCOL_HEADERS },
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
        headers: {
          authorization: `Bearer ${TOKEN}`,
          'content-type': 'application/json',
          ...PROTOCOL_HEADERS,
        },
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
        headers: {
          authorization: `Bearer ${TOKEN}`,
          'content-type': 'application/json',
          ...PROTOCOL_HEADERS,
        },
        body: JSON.stringify({
          projectPath: `/private/${secret}/does-not-exist-as-dir`,
          from: 'from.txt',
          to: 'to.txt',
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

/**
 * A synthetic one-procedure router: the only way to prove a rejected request never reached
 * a handler is to own the handler. Nothing here reimplements product behavior — the spy
 * records that it was called, and the protocol gate is what decides whether it ever is.
 */
function probeRouter(): {
  dispatched: ReturnType<typeof vi.fn>
  router: DaemonHttpOptions['router']
} {
  const t = initTRPC.create()
  const dispatched = vi.fn(() => 'dispatched')
  return { dispatched, router: t.router({ probe: t.procedure.query(dispatched) }) }
}

const protocolMismatches: Array<
  [label: string, headers: Record<string, string>, received: number | null]
> = [
  ['no version at all', {}, null],
  ['a non-numeric version', { [PROTOCOL_VERSION_HEADER]: 'one' }, null],
  ['a fractional version', { [PROTOCOL_VERSION_HEADER]: `${PROTOCOL_VERSION}.5` }, null],
  ['an empty version', { [PROTOCOL_VERSION_HEADER]: '' }, null],
  [
    'an older version',
    { [PROTOCOL_VERSION_HEADER]: String(PROTOCOL_VERSION - 1) },
    PROTOCOL_VERSION - 1,
  ],
  [
    'a newer version',
    { [PROTOCOL_VERSION_HEADER]: String(PROTOCOL_VERSION + 1) },
    PROTOCOL_VERSION + 1,
  ],
]

describe('daemon http surface — the protocol gate', () => {
  it.each(
    protocolMismatches,
  )('refuses a /trpc call announcing %s before any handler runs', async (_label, headers, received) => {
    const probe = probeRouter()
    const isolated = await startTestDaemon({ router: probe.router })

    try {
      const res = await fetch(`${isolated.base}/trpc/probe`, {
        headers: { authorization: `Bearer ${TOKEN}`, ...headers },
      })
      const error = await expectPublicHttpFailure(res, 409, 'protocol.update-required')
      expect(error).toMatchObject({
        category: 'conflict',
        retryable: false,
        details: { expected: PROTOCOL_VERSION, received },
      })
      expect(probe.dispatched).not.toHaveBeenCalled()
    } finally {
      await stopTestDaemon(isolated.daemon)
    }
  })

  it('dispatches a /trpc call announcing the matching version', async () => {
    const probe = probeRouter()
    const isolated = await startTestDaemon({ router: probe.router })

    try {
      const res = await fetch(`${isolated.base}/trpc/probe`, {
        headers: { authorization: `Bearer ${TOKEN}`, ...PROTOCOL_HEADERS },
      })
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ result: { data: 'dispatched' } })
      expect(probe.dispatched).toHaveBeenCalledOnce()
    } finally {
      await stopTestDaemon(isolated.daemon)
    }
  })

  it.each(
    protocolMismatches,
  )('refuses a pairing exchange announcing %s before the grant is consumed', async (_label, headers, received) => {
    const exchangePairing = vi.fn(async (_credential: string) => null)
    const isolated = await startTestDaemon({ exchangePairing })

    try {
      const res = await fetch(`${isolated.base}/pair`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({ credential: PAIRING_TOKEN }),
      })
      const error = await expectPublicHttpFailure(res, 409, 'protocol.update-required')
      expect(error).toMatchObject({ details: { expected: PROTOCOL_VERSION, received } })
      expect(exchangePairing).not.toHaveBeenCalled()
    } finally {
      await stopTestDaemon(isolated.daemon)
    }
  })

  it('exchanges a pairing grant announcing the matching version', async () => {
    const exchangePairing = vi.fn(exchangeTestPairing)
    const isolated = await startTestDaemon({ exchangePairing })

    try {
      const res = await fetch(`${isolated.base}/pair`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...PROTOCOL_HEADERS },
        body: JSON.stringify({ credential: PAIRING_TOKEN }),
      })
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ token: CLIENT_TOKEN })
      expect(exchangePairing).toHaveBeenCalledOnce()
    } finally {
      await stopTestDaemon(isolated.daemon)
    }
  })

  // The two ordering tests below pin the decision recorded in `rejectProtocolMismatch`:
  // the protocol gate never displaces a check its route already leads with.
  it('answers an unauthenticated /trpc call with the auth error, not the protocol error', async () => {
    const probe = probeRouter()
    const isolated = await startTestDaemon({ router: probe.router })

    try {
      const res = await fetch(`${isolated.base}/trpc/probe`)
      await expectPublicHttpFailure(res, 401, 'auth.unauthenticated')
      expect(probe.dispatched).not.toHaveBeenCalled()
    } finally {
      await stopTestDaemon(isolated.daemon)
    }
  })

  it('keeps the pairing rate limit outside the protocol gate', async () => {
    const exchangePairing = vi.fn(async (_credential: string) => null)
    const isolated = await startTestDaemon({ exchangePairing })
    const stale = { [PROTOCOL_VERSION_HEADER]: String(PROTOCOL_VERSION + 1) }

    try {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const res = await fetch(`${isolated.base}/pair`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...stale },
          body: JSON.stringify({ credential: `pairing-attempt-${attempt}` }),
        })
        await expectPublicHttpFailure(res, 409, 'protocol.update-required')
      }

      const limited = await fetch(`${isolated.base}/pair`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...stale },
        body: JSON.stringify({ credential: 'rate-limited-pairing-attempt' }),
      })
      expect(limited.headers.get('retry-after')).toBe('60')
      await expectPublicHttpFailure(limited, 429, 'resource.unavailable')
      expect(exchangePairing).not.toHaveBeenCalled()
    } finally {
      await stopTestDaemon(isolated.daemon)
    }
  })

  it('mints exactly one request id per refused request', async () => {
    const probe = probeRouter()
    const isolated = await startTestDaemon({ router: probe.router })

    try {
      const requestIds: string[] = []
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const res = await fetch(`${isolated.base}/trpc/probe`, {
          headers: { authorization: `Bearer ${TOKEN}` },
        })
        const error = await expectPublicHttpFailure(res, 409, 'protocol.update-required')
        requestIds.push(error.requestId)
      }
      expect(new Set(requestIds).size).toBe(2)
    } finally {
      await stopTestDaemon(isolated.daemon)
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

/** Complete the versioned hello/ready handshake before terminal or watches traffic. */
async function readySession(ws: WebSocket): Promise<void> {
  const reply = nextMessage(ws)
  ws.send(JSON.stringify({ t: 'session:hello', protocolVersion: 1 }))
  await expect(reply).resolves.toMatchObject({ t: 'session:ready', protocolVersion: 1 })
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

  it('accepts the right subprotocol and answers terminal:create after ready', async () => {
    const ws = await connect(`porcelain.${TOKEN}`)
    await readySession(ws)
    const reply = nextMessage(ws)
    ws.send(JSON.stringify({ t: 'terminal:create', reqId: 'r1', name: 't', cwd: '/tmp' }))
    expect(await reply).toEqual({ t: 'terminal:created', reqId: 'r1', id: 'term-1' })
    ws.close()
  })

  it('replies with a typed error for an unknown terminal:attach id', async () => {
    const ws = await connect(`porcelain.${TOKEN}`)
    await readySession(ws)
    const reply = nextMessage(ws)
    ws.send(JSON.stringify({ t: 'terminal:attach', reqId: 'r2', id: 'ghost' }))
    expect(await reply).toMatchObject({
      t: 'terminal:error',
      reqId: 'r2',
      id: 'ghost',
      error: {
        code: 'terminal.not-found',
        category: 'not-found',
        retryable: false,
      },
    })
    ws.close()
  })

  it('drops malformed input without closing the socket', async () => {
    const ws = await connect(`porcelain.${TOKEN}`)
    await readySession(ws)
    ws.send('}{ not json')
    const reply = nextMessage(ws)
    ws.send(JSON.stringify({ t: 'terminal:create', reqId: 'r3', name: 't', cwd: '/tmp' }))
    expect(await reply).toEqual({ t: 'terminal:created', reqId: 'r3', id: 'term-1' })
    ws.close()
  })
})
