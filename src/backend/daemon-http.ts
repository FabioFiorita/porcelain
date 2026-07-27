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
 * both through the ONE `authenticate` function below — shared secret only,
 * constant-time over sha256 digests; static assets are served UNAUTHENTICATED by
 * design; CORS is scoped (echo only the allowed origin or the file:// renderer's
 * `null`), never `*`. The behaviour here must stay identical to what `server.ts`
 * did inline — the test tier exists to make a regression bite.
 */
export interface DaemonHttpOptions {
  /** sha256 digest of the shared secret (resolved by the entry file before boot). */
  tokenHash: Buffer
  /** The single origin CORS echoes (dev Vite server); '' disables the echo. */
  allowedOrigin: string
  /** The appRouter, served over tRPC's fetch adapter. */
  router: AnyRouter
  /** Called with the upgraded socket for each authenticated /session connection. */
  onSession: (ws: WebSocket) => void
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
  /**
   * Swap the live shared-token hash (Revoke all / rotate). Copies the buffer so the
   * caller can reuse theirs; subsequent authenticate() calls use the new digest.
   */
  setTokenHash: (hash: Buffer) => void
}

const WS_PROTOCOL_PREFIX = 'porcelain.'

export function createDaemonHttp(opts: DaemonHttpOptions): DaemonHttp {
  const { allowedOrigin, router, onSession, serveStatic } = opts
  // Mutable: Revoke all writes a new secret and swaps this digest without restarting.
  // Copied on set so a caller reusing their buffer can't race a concurrent compare.
  let tokenHash = Buffer.from(opts.tokenHash)

  /**
   * THE gate. Every /trpc request and every /session upgrade passes through here, so it is
   * the single most security-critical function in the daemon.
   *
   * One credential: the shared secret (`~/.porcelain/daemon-token`). Compared constant-time
   * over a fixed-length sha256 digest (timingSafeEqual demands equal lengths, and hashing
   * removes any length signal from the secret itself). Per-device credentials were removed
   * deliberately — one token, revoke-all rotates it for everyone.
   */
  function authenticate(provided: string | undefined): boolean {
    if (provided === undefined || provided === '') return false
    return timingSafeEqual(tokenHash, createHash('sha256').update(provided).digest())
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
      if (!authenticate(bearerToken(req))) {
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
    const ok = candidate !== undefined && authenticate(candidate.slice(WS_PROTOCOL_PREFIX.length))
    if (req.url !== '/session' || !ok) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => onSession(ws))
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
    setTokenHash: (hash) => {
      tokenHash = Buffer.from(hash)
    },
  }
}
