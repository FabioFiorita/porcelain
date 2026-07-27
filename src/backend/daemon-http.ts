import { createHash, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import type { AnyRouter } from '@trpc/server'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { type WebSocket, WebSocketServer } from 'ws'

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
 * both through the ONE `authenticate` function below — which accepts either the
 * shared secret or a per-device credential (phase 4), always constant-time over
 * sha256 digests, never one gate per credential kind; static assets are served
 * UNAUTHENTICATED by design; CORS is scoped (echo only the allowed origin or the
 * file:// renderer's `null`), never `*`. The behaviour here must stay identical to
 * what `server.ts` did inline — the test tier exists to make a regression bite.
 */
export interface DaemonHttpOptions {
  /** sha256 digest of the shared secret (resolved by the entry file before boot). */
  tokenHash: Buffer
  /** The single origin CORS echoes (dev Vite server); '' disables the echo. */
  allowedOrigin: string
  /** The appRouter, served over tRPC's fetch adapter. */
  router: AnyRouter
  /**
   * The SECOND thing that can authenticate a request (phase 4): a per-device credential
   * minted by pairing. Returns the device id, or null. Injected — like `pairing` — so the
   * gate stays store-free and a test can boot it without a devices file.
   *
   * MUST be constant-time and MUST fail closed before its store is loaded (`devices.ts`).
   * Omitted ⇒ the shared token is the only credential, i.e. exactly pre-phase-4 behaviour.
   */
  matchDevice?: (provided: string) => string | null
  /**
   * Called with the upgraded socket for each authenticated /session connection, plus the
   * device it authenticated as (null ⇒ the shared token, i.e. an unattributable client).
   */
  onSession: (ws: WebSocket, deviceId: string | null) => void
  /** Serves the renderer dist for non-/trpc GET/HEAD (unauthenticated). */
  serveStatic: (req: IncomingMessage, res: ServerResponse) => Promise<void>
  /**
   * Backs `POST /pair` — the daemon's one unauthenticated dynamic route. The entry
   * file supplies it (it owns the token that a successful exchange yields); omitting
   * it disables the route entirely (it 404s), which is what tests that don't care
   * about pairing get.
   */
  pairing?: {
    /** Whether a human has a pairing window open right now. */
    hasPending: () => boolean
    /**
     * Exchange a code for a credential; the token is returned ONLY on 'ok'. `label` is the
     * name the redeeming device gave itself (peer-supplied — the store sanitizes it).
     * Async since phase 4: minting a device credential writes the roster to disk.
     */
    redeem: (code: string, label: string) => Promise<{ result: string; token?: string }>
  }
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
  const { tokenHash, allowedOrigin, router, onSession, serveStatic, pairing, matchDevice } = opts

  /**
   * THE gate. Every /trpc request and every /session upgrade passes through here, so it is
   * the single most security-critical function in the daemon.
   *
   * Two credentials are accepted, and the order matters only for cost, not for trust:
   * the shared secret (`~/.porcelain/daemon-token` — kept working so existing setups don't
   * all have to re-pair at once, plans/environments-v2.md), or any live per-device
   * credential (phase 4). Both are compared constant-time over fixed-length sha256 digests
   * (timingSafeEqual demands equal lengths, and hashing removes any length signal from the
   * secret itself). A shared-token holder is `{ ok: true, deviceId: null }` — authenticated
   * but unattributable, which is exactly what the roster shows.
   */
  function authenticate(provided: string | undefined): { ok: boolean; deviceId: string | null } {
    if (provided === undefined || provided === '') return { ok: false, deviceId: null }
    if (timingSafeEqual(tokenHash, createHash('sha256').update(provided).digest())) {
      return { ok: true, deviceId: null }
    }
    const deviceId = matchDevice?.(provided) ?? null
    return { ok: deviceId !== null, deviceId }
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

  function readBody(req: IncomingMessage): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => resolve(Buffer.concat(chunks)))
      req.on('error', reject)
    })
  }

  // A pairing exchange is a tiny JSON object; anything larger is not one. Bounded so
  // an unauthenticated caller can't stream unbounded bytes into daemon memory.
  const MAX_PAIR_BODY_BYTES = 1024

  /**
   * Buffer at most `max` bytes; past that, STOP BUFFERING but keep draining, and
   * resolve null. Memory stays bounded either way — the reason we drain instead of
   * destroying the socket is that a destroyed request never delivers our 413, so the
   * caller sees a connection reset and can't tell "too large" from "daemon crashed"
   * (caught by the oversized-body test).
   */
  function readBoundedBody(req: IncomingMessage, max: number): Promise<Buffer | null> {
    return new Promise<Buffer | null>((resolve, reject) => {
      const chunks: Buffer[] = []
      let size = 0
      let overflowed = false
      req.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > max) {
          overflowed = true
          chunks.length = 0
          return
        }
        chunks.push(chunk)
      })
      req.on('end', () => resolve(overflowed ? null : Buffer.concat(chunks)))
      req.on('error', reject)
    })
  }

  /**
   * `POST /pair` — the ONE unauthenticated dynamic route, and a deliberate exception to
   * "auth is never optional" (audit skill). It's the exchange that lets a new device get
   * a credential without the human ferrying the long-lived token by hand. What keeps it
   * narrow, all of which must hold together:
   *
   * - **404 unless a human has a pairing window open.** At rest the route does not exist,
   *   so there is nothing to probe or grind; `pairing.ts` owns the 40-bit code, the TTL,
   *   single-use, and the 5-attempt burn.
   * - **`application/json` is REQUIRED.** That forces a CORS preflight for any
   *   cross-origin browser caller, and the preflight fails against our scoped CORS — so
   *   drive-by web content (which can reach 127.0.0.1) cannot even send the request. A
   *   simple `text/plain` POST would skip preflight, so rejecting it is load-bearing, not
   *   tidiness.
   * - **Bounded body, no logging.** Neither the code nor the token is ever printed.
   *
   * Responses are deliberately coarse — the caller learns refused vs accepted, and
   * `reason` only distinguishes the states a human needs to act on differently.
   */
  async function handlePair(
    req: IncomingMessage,
    res: ServerResponse,
    cors: Record<string, string>,
  ): Promise<void> {
    const json = { ...cors, 'content-type': 'application/json' }
    if (pairing === undefined || !pairing.hasPending()) {
      res.writeHead(404, cors)
      res.end()
      return
    }
    if (req.method !== 'POST') {
      res.writeHead(405, cors)
      res.end()
      return
    }
    // Load-bearing: see the preflight note above.
    if (!(req.headers['content-type'] ?? '').includes('application/json')) {
      res.writeHead(415, cors)
      res.end()
      return
    }
    const body = await readBoundedBody(req, MAX_PAIR_BODY_BYTES)
    if (body === null) {
      res.writeHead(413, cors)
      res.end()
      return
    }
    let code: unknown
    let label: unknown
    try {
      const parsed = JSON.parse(body.toString('utf8')) as { code?: unknown; label?: unknown }
      code = parsed.code
      label = parsed.label
    } catch {
      res.writeHead(400, cors)
      res.end()
      return
    }
    if (typeof code !== 'string') {
      res.writeHead(400, cors)
      res.end()
      return
    }
    // The device names itself. Peer-supplied, so it is sanitized + capped downstream
    // (devices.ts) — it is a display string, never an identifier.
    const { result, token } = await pairing.redeem(code, typeof label === 'string' ? label : '')
    if (result !== 'ok' || token === undefined) {
      res.writeHead(401, json)
      res.end(JSON.stringify({ error: result }))
      return
    }
    res.writeHead(200, json)
    res.end(JSON.stringify({ token }))
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
      if (!url.startsWith('/trpc')) {
        // OPTIONS anywhere is a CORS preflight — answer it, don't fall to static.
        if (req.method === 'OPTIONS') {
          res.writeHead(204, cors)
          res.end()
          return
        }
        // The pairing exchange — unauthenticated by necessity, and narrow by design
        // (it 404s unless a human has a pairing window open). See handlePair.
        if (url.split('?')[0] === '/pair') {
          await handlePair(req, res, cors)
          return
        }
        // Everything that isn't /trpc or /pair (and isn't the /session WS upgrade, which
        // never reaches here) is the renderer dist — the browser client's app shell.
        // Static assets are UNAUTHENTICATED by design (the shell is not secret; the
        // token gate stays on /trpc + /session — see static-server.ts). GET/HEAD only.
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
      if (!authenticate(bearerToken(req)).ok) {
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
        createContext: () => ({}),
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
  const wss = new WebSocketServer({ noServer: true })

  function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    const offered = (req.headers['sec-websocket-protocol'] ?? '')
      .split(',')
      .map((protocol) => protocol.trim())
    const candidate = offered.find((protocol) => protocol.startsWith(WS_PROTOCOL_PREFIX))
    const auth =
      candidate === undefined
        ? { ok: false, deviceId: null }
        : authenticate(candidate.slice(WS_PROTOCOL_PREFIX.length))
    if (req.url !== '/session' || !auth.ok) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    // The session carries the device the socket authenticated as, so the roster can say
    // what each paired device is doing — and so revoking one can close its live sockets.
    wss.handleUpgrade(req, socket, head, (ws) => onSession(ws, auth.deviceId))
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

  return { server, requestListener, handleUpgrade }
}
