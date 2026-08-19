import { createHash, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import { PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
import { MAX_SESSION_MESSAGE_BYTES } from '@porcelain/contracts/terminal'
import type { AnyRouter } from '@trpc/server'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { type WebSocket, WebSocketServer } from 'ws'
import { logUnexpectedError } from '../../daemon-composition/error-log'
import {
  normalizePublicError,
  publicErrorFor,
  writePublicError,
} from '../../daemon-composition/public-error'
import { createRequestId } from '../../daemon-composition/request-id'
import type { AuthIdentity } from './access-store'
import { handleDevAuthRequest } from './dev-auth-http'
import { serveMcpRoute } from './remote-mcp-route'
import { parseAllowedOrigins } from './remote-origins'
import { rejectProtocolMismatch } from './remote-protocol'

export { parseAllowedOrigins } from './remote-origins'

/**
 * The daemon's HTTP + WS surface, factored out of `server.ts` so it can be booted
 * for real inside a test (`remote-http.test.ts`) on an ephemeral port. This is the
 * whole request/upgrade pipeline — the token gate, the CORS scope, the tRPC fetch
 * adapter, and the WS-upgrade handshake — with nothing entangled: the entry file
 * (`server.ts`) owns the env guard, token resolution, migrations, watch/broadcast
 * wiring, the tailnet init, and the process lifecycle, and hands the resolved
 * inputs in here.
 *
 * SECURITY INVARIANTS (Remote boundary): every /trpc request is token-gated (Bearer),
 * every /session WS upgrade is token-gated (the `porcelain.<token>` subprotocol),
 * both through the ONE `authenticate` function below. The host administrator is
 * compared constant-time over a sha256 digest; paired devices are validated
 * individually by the access store. POST /pair is the only unauthenticated
 * mutation, and accepts rate-limited, size-capped one-time credentials. Static
 * assets are public by design; CORS is scoped, never `*`. GET /canvas/<token> is
 * gated too, but NOT through `authenticate` — a plain `<iframe src>` navigation
 * carries no Authorization header, so a short-lived, Project+Canvas-scoped
 * capability token (minted only to an already-Bearer-authenticated tRPC caller
 * — canvas-access-tokens.ts) is the credential there; see canvas-http.ts for
 * why the route exists at all.
 *
 * POST /mcp is the agent tool surface: Bearer-gated through the same `authenticate`,
 * plus an Origin check a loopback bind does not give us — see remote-mcp-route.ts.
 *
 * GET /dev-auth is the one deliberate hole, mounted ONLY when the caller passes
 * `devAutoAuth` (server.ts does so only under PORCELAIN_DEV) — see dev-auth-http.ts for
 * what it hands out and why the Bearer gate below still applies to everything behind it.
 *
 * Both dispatching routes also require the exact wire protocol this build speaks
 * (`rejectProtocolMismatch` below): the daemon serves independently updated clients
 * and does not emulate older ones.
 */
export interface RemoteHttpOptions {
  /** sha256 digest of the local host administrator credential. */
  adminTokenHash: Buffer
  /** Validate an individually issued client token. */
  authenticateClient: (token: string) => Promise<AuthIdentity | null>
  /** Atomically consume a one-time pairing grant and issue a client token. */
  exchangePairing: (
    credential: string,
  ) => Promise<{ token: string; client: { id: string; label: string; createdAt: string } } | null>
  /**
   * Trusted browser Hub origins. The legacy singular form accepts a comma-separated list;
   * `allowedOrigins` is preferred by new callers. Empty means no cross-origin CORS echo.
   */
  allowedOrigin?: string
  allowedOrigins?: readonly string[]
  /** The appRouter, served over tRPC's fetch adapter. */
  router: AnyRouter
  /** Called with the upgraded socket and authenticated identity. */
  onSession: (ws: WebSocket, identity: AuthIdentity) => void
  /** Serves the renderer dist for non-/trpc GET/HEAD (unauthenticated). */
  serveStatic: (req: IncomingMessage, res: ServerResponse) => Promise<void>
  /** Serves GET /canvas/<token> — see canvas-http.ts. Token-gated, not Bearer-gated. */
  serveCanvas: (req: IncomingMessage, res: ServerResponse) => Promise<void>
  /** Serves GET /file-preview/<token> — see file-preview-http.ts. Token-gated, not Bearer-gated. */
  serveFilePreview: (req: IncomingMessage, res: ServerResponse) => Promise<void>
  /** DEVELOPMENT ONLY — see dev-auth-http.ts. Omitted in production; the route then does not exist. */
  devAutoAuth?: () => Promise<string>
  /** Serves POST /mcp once gated. Omitted means the route does not exist. */
  serveMcp?: (req: IncomingMessage, res: ServerResponse) => Promise<void>
}

export interface RemoteHttp {
  /** The http.Server, NOT yet listening — the caller owns `.listen()`. */
  server: Server
  /** The (req, res) listener; shared with the optional tailnet listener. */
  requestListener: (req: IncomingMessage, res: ServerResponse) => void
  /** The upgrade handler; shared with the optional tailnet listener. */
  handleUpgrade: (req: IncomingMessage, socket: Duplex, head: Buffer) => void
}

const WS_PROTOCOL_PREFIX = 'porcelain.'

export function createRemoteHttp(opts: RemoteHttpOptions): RemoteHttp {
  const allowedOrigins = parseAllowedOrigins([
    ...(opts.allowedOrigin === undefined ? [] : [opts.allowedOrigin]),
    ...(opts.allowedOrigins ?? []),
  ])
  const { router, onSession, serveStatic, serveCanvas, serveFilePreview } = opts
  const adminTokenHash = Buffer.from(opts.adminTokenHash)

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

  // Echo only explicitly trusted browser Hub origins (or packaged file://'s literal "null").
  // CORS is a courtesy layer; the Bearer check remains the real gate.
  function corsHeaders(req: IncomingMessage): Record<string, string> {
    const origin = req.headers.origin
    if (origin === undefined) return {}
    if (origin !== 'null' && !allowedOrigins.includes(origin)) return {}
    return {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': `content-type,authorization,${PROTOCOL_VERSION_HEADER}`,
      vary: 'origin',
    }
  }

  function browserOriginAllowed(req: IncomingMessage): boolean {
    const origin = req.headers.origin
    if (origin === undefined || origin === 'null') return true
    if (allowedOrigins.includes(origin)) return true
    const host = req.headers.host
    if (host === undefined) return false
    try {
      // Compare authority only: a reverse proxy may terminate HTTPS before forwarding the upgrade.
      return new URL(origin).host === host
    } catch {
      return false
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

  /**
   * THE protocol gate. Every dispatching route — /trpc and POST /pair — must announce
   * exactly the protocol this build speaks. Absent, malformed, older, and newer are one
   * outcome: `protocol.update-required`, carrying what was expected and what arrived, the
   * same contract the session handshake refuses a mismatched socket with. There is no
   * optional header, no inferred app version, and no per-route plain-text variant.
   *
   * ORDER OF CHECKS (Remote boundary): this runs *after* the check each route already leads with —
   * the Bearer gate on /trpc, the rate limiter on POST /pair — and never reorders them.
   * Authentication stays the daemon's outermost fail-closed gate, so an anonymous caller
   * still gets `auth.unauthenticated` and cannot use a version reply to probe a daemon it
   * has no credential for; the pairing limiter stays outermost for the same reason, so a
   * mismatched client cannot spend unlimited pairing attempts. It still precedes every
   * dispatch: a rejected request reaches no router procedure and no grant exchange, and
   * spends only the one request ID its route already minted.
   *
   * Returns true when it has already written the response.
   */
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
    requestId: string,
  ): Promise<void> {
    if (req.method !== 'POST') {
      res.writeHead(405, { ...cors, allow: 'POST' })
      res.end()
      return
    }
    if (pairingRateLimited(req)) {
      writePublicError(res, 429, cors, publicErrorFor('resource.unavailable', requestId), {
        'retry-after': '60',
      })
      return
    }
    if (rejectProtocolMismatch(req, res, cors, requestId)) return
    const contentLength = Number(req.headers['content-length'] ?? '0')
    if (!Number.isFinite(contentLength) || contentLength > 8_192) {
      writePublicError(res, 413, cors, publicErrorFor('request.invalid', requestId))
      return
    }
    const raw = await readBody(req, 8_192)
    if (raw === null) {
      writePublicError(res, 413, cors, publicErrorFor('request.invalid', requestId))
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
      writePublicError(res, 400, cors, publicErrorFor('request.invalid', requestId))
      return
    }
    const exchanged = await opts.exchangePairing(credential)
    if (exchanged === null) {
      writePublicError(res, 401, cors, publicErrorFor('auth.unauthenticated', requestId))
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

  function writeUnexpectedRequestFailure(
    res: ServerResponse,
    cors: Record<string, string>,
    error: unknown,
    requestId: string,
  ): void {
    logUnexpectedError({ error, requestId, path: undefined })
    if (!res.headersSent) {
      writePublicError(res, 500, cors, publicErrorFor('internal.unexpected', requestId))
    } else if (!res.writableEnded) {
      res.end()
    }
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
    const url = req.url ?? '/'
    if (url === '/pair' && req.method === 'OPTIONS') {
      res.writeHead(204, cors)
      res.end()
      return
    }
    if (url === '/pair' && req.method === 'POST') {
      const requestId = createRequestId()
      try {
        await handlePairing(req, res, cors, requestId)
      } catch (error) {
        writeUnexpectedRequestFailure(res, cors, error, requestId)
      }
      return
    }
    // Development auto-authorization. Absent in production: no option, no route.
    if (url === '/dev-auth' && opts.devAutoAuth !== undefined) {
      await handleDevAuthRequest(req, res, cors, opts.devAutoAuth)
      return
    }
    if (url.startsWith('/canvas/')) {
      // A distinct token-gated route, not the Bearer gate below — see canvas-http.ts
      // and the SECURITY INVARIANTS note above. No CORS headers: this route is only
      // ever loaded as an iframe navigation (no fetch/XHR caller needs it), and it
      // sets its own tight per-response CSP that CORS would add nothing to.
      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }
      await serveCanvas(req, res)
      return
    }
    if (url.startsWith('/file-preview/')) {
      // Same token-gated shape as /canvas/ above: an iframe navigation with the grant
      // in the URL, its own per-response CSP, and no CORS (no fetch caller exists).
      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }
      await serveFilePreview(req, res)
      return
    }
    if (url === '/mcp' || url.startsWith('/mcp?')) {
      // Gates and rationale: remote-mcp-route.ts. An unexpected throw falls to the
      // listener's catch below — /mcp has no Porcelain public-error shape to map onto.
      await serveMcpRoute({
        req,
        res,
        cors,
        authenticate: () => authenticate(bearerToken(req)),
        allowedOrigins,
        serveMcp: opts.serveMcp,
      })
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
    const requestId = createRequestId()
    try {
      const identity = await authenticate(bearerToken(req))
      if (identity === null) {
        writePublicError(res, 401, cors, publicErrorFor('auth.unauthenticated', requestId))
        return
      }
      if (rejectProtocolMismatch(req, res, cors, requestId)) return
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
        createContext: () => ({ auth: identity, requestId }),
        onError: ({ error, path }) => {
          const normalized = normalizePublicError(error, requestId)
          if (normalized.unexpected) logUnexpectedError({ error, requestId, path })
        },
        req: new Request(`http://127.0.0.1${url}`, { method, headers, body }),
      })
      res.writeHead(response.status, {
        ...Object.fromEntries(response.headers.entries()),
        ...cors,
      })
      res.end(Buffer.from(await response.arrayBuffer()))
    } catch (error) {
      writeUnexpectedRequestFailure(res, cors, error, requestId)
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
    if (!browserOriginAllowed(req)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
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
  // expects. Dynamic request failures handle themselves above; this last-resort
  // path preserves non-public static-route failures without logging raw details.
  const requestListener = (req: IncomingMessage, res: ServerResponse): void => {
    handleRequest(req, res).catch((error) => {
      logUnexpectedError({ error, requestId: createRequestId(), path: undefined })
      if (!res.headersSent) res.writeHead(500, corsHeaders(req))
      if (!res.writableEnded) res.end()
    })
  }

  const server = createServer(requestListener)
  server.on('upgrade', handleUpgrade)

  return {
    server,
    requestListener,
    handleUpgrade,
  }
}
