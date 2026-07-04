import { createHash, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { WebSocketServer } from 'ws'
import { router } from './api'
import { subscribeAppEvents } from './app-events'
import { initConfigDir, loadConfig } from './config-store'
import { seedDevConfig } from './dev-config'
import { migrateLayersFromConfig } from './layers-store'
import { migrateNotesFromConfig } from './notes-store'
import { watchAgentChannels } from './review-watch'
import { migrateReviewedFromConfig } from './reviewed-store'
import { broadcastAppEvent, createSession } from './session'
import { rendererDistExists, serveStatic } from './static-server'
import { initTailnetHandlers, startTailnetListener } from './tailnet-listener'
import { ensureDaemonToken } from './token-file'

/**
 * The daemon entry point — the Electron-free half of Porcelain, spawned by the
 * shell (`src/main/daemon.ts`) as `ELECTRON_RUN_AS_NODE` child and built as its
 * own bundle (`out/main/daemon/server.js`, see electron.vite.config.ts). It
 * serves the appRouter over HTTP (`/trpc`, tRPC's fetch adapter — the same
 * pattern the Stage-1 IPC shuttle used) and the per-window session channel over
 * one WebSocket (`/session`, see session.ts / shared/ws-protocol.ts).
 *
 * SECURITY INVARIANTS (audit skill):
 * - The daemon binds 127.0.0.1 ALWAYS, and additionally the detected Tailscale
 *   interface (100.64/10) when the user enables the setting — never 0.0.0.0 or
 *   any other interface. The tailnet listener shares this listener's handlers,
 *   so the same token gate applies to it automatically.
 * - Every request is token-gated, ALWAYS. Loopback is reachable from any webpage
 *   the user's browser has open (fetch to 127.0.0.1, and WebSockets have no CORS
 *   at all), so an unauthenticated listener would hand `terminal:create` — a
 *   shell — to drive-by web content. /trpc requires `authorization: Bearer
 *   <token>`; the WS upgrade carries the token as the `porcelain.<token>`
 *   subprotocol (chosen over `?token=` because query strings leak into logs and
 *   proxies; the subprotocol header does not). Comparisons are constant-time
 *   over sha256 digests.
 *
 * Contract with the shell: exactly ONE stdout line, `{"port": N}`, once
 * listening (everything else logs to stderr — and the token is NEVER printed:
 * the parent passed it via env, so it already knows it), and self-exit when
 * stdin ends (the parent died — don't linger as an orphan).
 */

// The shell resolves userData (it owns the dev `-dev` suffix) and hands the
// config dir down; refusing to start without it beats writing config.json
// somewhere surprising.
const userData = process.env.PORCELAIN_USER_DATA
if (userData === undefined || userData === '') {
  console.error('[daemon] PORCELAIN_USER_DATA is required')
  process.exit(1)
}
initConfigDir(userData)

// The session token, now a persistent shared secret (plans/remote-environments.md
// Phase 2, replacing the per-app-run token the shell used to mint). The shell
// always passes one via env (PORCELAIN_DAEMON_TOKEN); when it's absent we read
// the same `~/.porcelain/daemon-token` file the shell reads (ensureDaemonToken
// creates it 0600 on first run) so a standalone/non-interactive spawn agrees on
// the same token instead of running with a throwaway nobody knows. An INTERACTIVE
// run without the env var still exits with instructions rather than silently
// minting — a human at a TTY should be told, not surprised.
async function resolveToken(): Promise<string> {
  const fromEnv = process.env.PORCELAIN_DAEMON_TOKEN
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv
  if (process.stdin.isTTY) {
    console.error(
      '[daemon] PORCELAIN_DAEMON_TOKEN is required — set it or create ~/.porcelain/daemon-token before starting the daemon',
    )
    process.exit(1)
  }
  return ensureDaemonToken()
}

// Constant-time check over fixed-length sha256 digests (timingSafeEqual demands
// equal lengths, and hashing removes any length signal from the secret itself).
// Set once in main() before either listener starts — a `let` because the token
// is resolved asynchronously (env or file) rather than at module load.
let tokenHash: Buffer

function tokenOk(provided: string | undefined): boolean {
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
const allowedOrigin = process.env.PORCELAIN_ALLOWED_ORIGIN ?? ''

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
      // Everything that isn't /trpc (and isn't the /session WS upgrade, which
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
    if (!tokenOk(bearerToken(req))) {
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
const WS_PROTOCOL_PREFIX = 'porcelain.'

function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
  const offered = (req.headers['sec-websocket-protocol'] ?? '')
    .split(',')
    .map((protocol) => protocol.trim())
  const candidate = offered.find((protocol) => protocol.startsWith(WS_PROTOCOL_PREFIX))
  if (
    req.url !== '/session' ||
    candidate === undefined ||
    !tokenOk(candidate.slice(WS_PROTOCOL_PREFIX.length))
  ) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (ws) => createSession(ws))
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

// Hand the shared handlers to the tailnet-listener module so its optional second
// listener (bound to the Tailscale interface, started/stopped live from the API)
// behaves identically to loopback — same token gate, never 0.0.0.0.
initTailnetHandlers(requestListener, handleUpgrade)

async function main(): Promise<void> {
  // Resolve the shared token (env or ~/.porcelain/daemon-token) and precompute its
  // digest BEFORE any listener accepts a connection — tokenOk reads tokenHash, so
  // it must be set first (both listeners start below).
  tokenHash = createHash('sha256')
    .update(await resolveToken())
    .digest()

  // The daemon serves the renderer dist to the browser client (Phase 3). In dev
  // the daemon runs before any build, so the dist is legitimately absent — log
  // once (static requests 404 until a build exists) instead of failing.
  if (!rendererDistExists()) {
    console.error(
      '[daemon] renderer dist not found — the browser client is unavailable until `pnpm build` runs (loopback + tRPC unaffected)',
    )
  }

  // Dev seeding moved here from the shell with the config store: the playground
  // recent is config state, and the daemon owns config now. Same semantics —
  // gated on dev (the shell sets PORCELAIN_DEV from `is.dev`) and a no-op once
  // any recent exists.
  if (process.env.PORCELAIN_DEV === '1') await seedDevConfig()

  // Move any legacy notes, flow layers, and reviewed marks out of userData/config.json
  // into their ~/.porcelain agent channels so the MCP can read (and, for layers, write)
  // them. One-time + idempotent; runs before any client reads notes/layers/reviewed.
  await migrateNotesFromConfig()
  await migrateLayersFromConfig()
  await migrateReviewedFromConfig()

  // Watch the agent channels so MCP-pushed review sets / resolved comments refresh
  // the open views — fanned out to every session over the WS channel.
  await watchAgentChannels()
  subscribeAppEvents(broadcastAppEvent)

  // Port 0 = OS-assigned (the default); PORCELAIN_DAEMON_PORT pins it (e2e/debugging).
  const requestedPort = Number(process.env.PORCELAIN_DAEMON_PORT ?? '') || 0
  server.listen(requestedPort, '127.0.0.1', () => {
    const address = server.address()
    if (address !== null && typeof address === 'object') {
      // The one stdout line the shell parses for the port — keep stdout otherwise silent.
      process.stdout.write(`${JSON.stringify({ port: address.port })}\n`)
    }
  })

  // If the user has the tailnet bind enabled, bring the second listener up too. A
  // missing Tailscale interface (or a listen error) at boot must NOT crash or block
  // the loopback listener — startTailnetListener logs to stderr and resolves null.
  if ((await loadConfig()).tailnetBind === true) await startTailnetListener()

  // Parent-death watchdog: the shell holds our stdin pipe open for our lifetime,
  // so stdin ending means the Electron process is gone — exit instead of orphaning.
  process.stdin.resume()
  process.stdin.on('end', () => process.exit(0))
  process.stdin.on('close', () => process.exit(0))
}

main().catch((error) => {
  console.error('[daemon] failed to start:', error)
  process.exit(1)
})
