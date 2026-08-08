import { createHash, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import { MAX_SESSION_MESSAGE_BYTES } from '@porcelain/contracts'
import type { AnyRouter } from '@trpc/server'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { type WebSocket, WebSocketServer } from 'ws'
import type { AuthIdentity } from '../stores/access-store'

/**
 * The daemon's HTTP + WS surface, factored out of `server.ts` so it can be booted
 * for real inside a test (`daemon-http.test.ts`) on an ephemeral port. This is the
 * whole request/upgrade pipeline — the token gate, the CORS scope, the tRPC fetch
 * adapter, and the WS-upgrade handshake — with nothing entangled: the entry file
 * (`server.ts`) owns the env guard, token resolution, migrations, watch/broadcast
 * wiring, the tailnet init, and the process lifecycle, and hands the resolved
 * inputs in here.
 *
 * SECURITY INVARIANTS (audit skill): every /trpc request is token-gated (Bearer),
 * every /session WS upgrade is token-gated (the `porcelain.<token>` subprotocol),
 * both through the ONE `authenticate` function below. The host administrator is
 * compared constant-time over a sha256 digest; paired devices are validated
 * individually by the access store. POST /pair is the only unauthenticated
 * mutation, and accepts rate-limited, size-capped one-time credentials. Static
 * assets are public by design; CORS is scoped, never `*`.
 */
export interface DaemonHttpOptions {
  /** sha256 digest of the local host administrator credential. */
  adminTokenHash: Buffer
  /** Validate an individually issued client token. */
  authenticateClient: (token: string) => Promise<AuthIdentity | null>
  /** Atomically consume a one-time pairing grant and issue a client token. */
  exchangePairing: (
    credential: string,
  ) => Promise<{ token: string; client: { id: string; label: string; createdAt: string } } | null>
  /** The single origin CORS echoes (dev Vite server); '' disables the echo. */
  allowedOrigin: string
  /** The appRouter, served over tRPC's fetch adapter. */
  router: AnyRouter
  /** Called with the upgraded socket and authenticated identity. */
  onSession: (ws: WebSocket, identity: AuthIdentity) => void
  /** Serves the renderer dist for non-/trpc GET/HEAD (unauthenticated). */
  serveStatic: (req: IncomingMessage, res: ServerResponse) => Promise<void>
}

export interface DaemonHttp {
  /** The http.Server, NOT yet listening — the caller owns `.listen()`. */
  server: Server
  /** The (req, res) listener; shared with the optional tailnet listener. */
  requestListener: (req: IncomingMessage, res: ServerResponse) => void
  /** The upgrade handler; shared with the optional tailnet listener. */
  handleUpgrade: (req: IncomingMessage, socket: Duplex, head: Buffer) => void
}

const WS_PROTOCOL_PREFIX = 'porcelain.'

export function createDaemonHttp(opts: DaemonHttpOptions): DaemonHttp {
  const { allowedOrigin, router, onSession, serveStatic } = opts
  const adminTokenHash = Buffer.from(opts.adminTokenHash)

  /**
   * THE gate. Every /trpc request and every /session upgrade passes through here, so it is
   * the single most security-critical function in the daemon.
   *
   * The local administrator credential is checked constant-time over a fixed sha256
   * digest. Otherwise the access store validates an individually revocable client token.
   */
  async function authenticate(provided: string | undefined): Promise<AuthIdentity | null> {
    if (provided === undefined || provided === '') return null
    const digest = createHash('sha256').update(provided).digest()
    if (timingSafeEqual(adminTokenHash, digest)) return { kind: 'admin' }
    return opts.authenticateClient(provided)
  }

  function bearerToken(req: IncomingMessage): string | undefined {
    const auth = req.headers.authorization
    return auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : undefined
  }

  // CORS is scoped, not `*`: echo only the dev renderer's origin (the shell passes
  // it via PORCELAIN_ALLOWED_ORIGIN — the Vite server in dev) or the literal
  // "null" origin the packaged app's file:// renderer sends. Requests without an
  // Origin header (the daemon smoke curl, non-browser callers) need no CORS
  // headers at all. CORS is the browser-side courtesy layer; the Bearer check on
  // the actual request is the real gate (a preflight can't carry it, so OPTIONS
  // requires nothing sensitive).
  function corsHeaders(req: IncomingMessage): Record<string, string> {
    const origin = req.headers.origin
    if (origin === undefined) return {}
    if (origin !== 'null' && (allowedOrigin === '' || origin !== allowedOrigin)) return {}
    return {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization',
      vary: 'origin',
    }
  }

  function readBody(req: IncomingMessage): Promise<Buffer>
  function readBody(req: IncomingMessage, maxBytes: number): Promise<Buffer | null>
  function readBody(
    req: IncomingMessage,
    maxBytes = Number.POSITIVE_INFINITY,
  ): Promise<Buffer | null> {
    return new Promise<Buffer | null>((resolve, reject) => {
      const chunks: Buffer[] = []
      let size = 0
      let tooLarge = false
      req.on('data', (chunk: Buffer) => {
        size += chunk.byteLength
        if (size <= maxBytes) chunks.push(chunk)
        else tooLarge = true
      })
      req.on('end', () => resolve(tooLarge ? null : Buffer.concat(chunks)))
      req.on('error', reject)
    })
  }

  const pairingAttempts = new Map<string, { windowStartedAt: number; count: number }>()

  function pairingRateLimited(req: IncomingMessage): boolean {
    const key = req.socket.remoteAddress ?? 'unknown'
    const now = Date.now()
    const current = pairingAttempts.get(key)
    if (current === undefined || now - current.windowStartedAt >= 60_000) {
      pairingAttempts.set(key, { windowStartedAt: now, count: 1 })
      return false
    }
    current.count += 1
    return current.count > 12
  }

  async function handlePairing(
    req: IncomingMessage,
    res: ServerResponse,
    cors: Record<string, string>,
  ): Promise<void> {
    if (req.method !== 'POST') {
      res.writeHead(405, { ...cors, allow: 'POST' })
      res.end()
      return
    }
    if (pairingRateLimited(req)) {
      res.writeHead(429, { ...cors, 'retry-after': '60' })
      res.end()
      return
    }
    const contentLength = Number(req.headers['content-length'] ?? '0')
    if (!Number.isFinite(contentLength) || contentLength > 8_192) {
      res.writeHead(413, cors)
      res.end()
      return
    }
    const raw = await readBody(req, 8_192)
    if (raw === null) {
      res.writeHead(413, cors)
      res.end()
      return
    }
    let credential: string
    try {
      const parsed: unknown = JSON.parse(raw.toString('utf8'))
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('credential' in parsed) ||
        typeof parsed.credential !== 'string'
      ) {
        throw new Error('invalid pairing body')
      }
      credential = parsed.credential
    } catch {
      res.writeHead(400, cors)
      res.end()
      return
    }
    const exchanged = await opts.exchangePairing(credential)
    if (exchanged === null) {
      res.writeHead(401, cors)
      res.end()
      return
    }
    const body = Buffer.from(JSON.stringify(exchanged))
    res.writeHead(200, {
      ...cors,
      'cache-control': 'no-store',
      'content-type': 'application/json',
      'content-length': String(body.byteLength),
    })
    res.end(body)
  }

  // Rebuild a fetch Request from the Node request and hand it to tRPC's official
  // fetch adapter — all protocol logic (batching, input decoding, error shapes)
  // stays in tRPC, exactly like the Stage-1 IPC shuttle. The appRouter context is
  // empty by design: no procedure may see the caller (per-connection concerns
  // live on the WS session). Extracted from createServer so the loopback listener
  // AND the optional tailnet listener share the identical handler — the token gate
  // below then applies to both automatically.
  async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const cors = corsHeaders(req)
    try {
      const url = req.url ?? '/'
      if (url === '/pair' && req.method === 'OPTIONS') {
        res.writeHead(204, cors)
        res.end()
        return
      }
      if (url === '/pair' && req.method === 'POST') {
        await handlePairing(req, res, cors)
        return
      }
      if (!url.startsWith('/trpc')) {
        // OPTIONS anywhere is a CORS preflight — answer it, don't fall to static.
        if (req.method === 'OPTIONS') {
          res.writeHead(204, cors)
          res.end()
          return
        }
        // Everything that isn't /trpc (and isn't the /session WS upgrade, which never
        // reaches here) is the renderer dist — the browser client's app shell. Static
        // assets are UNAUTHENTICATED by design (the shell is not secret; the token gate
        // stays on /trpc + /session — see static-server.ts). GET/HEAD only.
        if (req.method === 'GET' || req.method === 'HEAD') {
          await serveStatic(req, res)
        } else {
          res.writeHead(404, cors)
          res.end()
        }
        return
      }
      if (req.method === 'OPTIONS') {
        res.writeHead(204, cors)
        res.end()
        return
      }
      const identity = await authenticate(bearerToken(req))
      if (identity === null) {
        res.writeHead(401, cors)
        res.end()
        return
      }
      const method = req.method ?? 'GET'
      const headers = new Headers()
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') headers.set(key, value)
        else if (Array.isArray(value)) for (const item of value) headers.append(key, item)
      }
      // Copied into a plain Uint8Array: Buffer satisfies BodyInit at runtime but
      // not in the lib types, and tRPC bodies are small JSON payloads.
      const body =
        method === 'GET' || method === 'HEAD' ? undefined : new Uint8Array(await readBody(req))
      const response = await fetchRequestHandler({
        endpoint: '/trpc',
        router,
        createContext: () => ({ auth: identity }),
        req: new Request(`http://127.0.0.1${url}`, { method, headers, body }),
      })
      res.writeHead(response.status, {
        ...Object.fromEntries(response.headers.entries()),
        ...cors,
      })
      res.end(Buffer.from(await response.arrayBuffer()))
    } catch (error) {
      console.error('[daemon] /trpc request failed:', error)
      if (!res.headersSent) res.writeHead(500, cors)
      res.end()
    }
  }

  // The WS upgrade is token-gated by hand (noServer): browsers can open
  // ws://127.0.0.1 from ANY page with no CORS check, so an unauthenticated
  // /session would be a drive-by remote shell. The client requests subprotocol
  // `porcelain.<token>`; ws's default protocol selection echoes the first offered
  // subprotocol back, which the browser requires for the handshake to complete.
  // One shared upgrade handler is wired onto every listener (loopback + tailnet).
  // This socket is a network boundary, not merely an internal event bus. Keep raw JSON below
  // the largest supported generic attachment (8 MiB plus base64/JSON overhead) so malformed
  // peers cannot make `raw.toString()` allocate ws's default 100 MiB payload.
  const wss = new WebSocketServer({ maxPayload: MAX_SESSION_MESSAGE_BYTES, noServer: true })

  function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    const offered = (req.headers['sec-websocket-protocol'] ?? '')
      .split(',')
      .map((protocol) => protocol.trim())
    const candidate = offered.find((protocol) => protocol.startsWith(WS_PROTOCOL_PREFIX))
    if (req.url !== '/session' || candidate === undefined) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    authenticate(candidate.slice(WS_PROTOCOL_PREFIX.length))
      .then((identity) => {
        if (identity === null || socket.destroyed) {
          if (!socket.destroyed) {
            socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
            socket.destroy()
          }
          return
        }
        wss.handleUpgrade(req, socket, head, (ws) => onSession(ws, identity))
      })
      .catch(() => {
        if (!socket.destroyed) socket.destroy()
      })
  }

  // Bridge the async request handler to the sync (req, res) signature http.Server
  // expects, swallowing rejections into a 500 log — one wrapper, reused for both
  // listeners so their behaviour is identical (same routes, same token gate).
  const requestListener = (req: IncomingMessage, res: ServerResponse): void => {
    handleRequest(req, res).catch((error) =>
      console.error('[daemon] request handler crashed:', error),
    )
  }

  const server = createServer(requestListener)
  server.on('upgrade', handleUpgrade)

  return {
    server,
    requestListener,
    handleUpgrade,
  }
}
