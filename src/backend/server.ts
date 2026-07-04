import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage } from 'node:http'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { WebSocketServer } from 'ws'
import { router } from './api'
import { subscribeAppEvents } from './app-events'
import { initConfigDir } from './config-store'
import { seedDevConfig } from './dev-config'
import { migrateLayersFromConfig } from './layers-store'
import { migrateNotesFromConfig } from './notes-store'
import { watchAgentChannels } from './review-watch'
import { migrateReviewedFromConfig } from './reviewed-store'
import { broadcastAppEvent, createSession } from './session'

/**
 * The daemon entry point — the Electron-free half of Porcelain, spawned by the
 * shell (`src/main/daemon.ts`) as `ELECTRON_RUN_AS_NODE` child and built as its
 * own bundle (`out/main/daemon/server.js`, see electron.vite.config.ts). It
 * serves the appRouter over HTTP (`/trpc`, tRPC's fetch adapter — the same
 * pattern the Stage-1 IPC shuttle used) and the per-window session channel over
 * one WebSocket (`/session`, see session.ts / shared/ws-protocol.ts).
 *
 * SECURITY INVARIANTS (audit skill):
 * - The daemon binds 127.0.0.1 ONLY — never 0.0.0.0 or a non-loopback interface
 *   (Phase 2 adds the tailnet bind, gated on the same token).
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

// The session token. The shell always passes one (PORCELAIN_DAEMON_TOKEN); a
// standalone operator (Phase 4's remote daemon) must set it explicitly — an
// interactive run without one exits with instructions instead of running open
// or printing a generated secret. The generate-if-absent branch only covers a
// non-interactive spawn whose parent forgot the env var: the daemon then runs
// with a token nobody knows, i.e. fail-closed, rather than fail-open.
function resolveToken(): string {
  const fromEnv = process.env.PORCELAIN_DAEMON_TOKEN
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv
  if (process.stdin.isTTY) {
    console.error('[daemon] PORCELAIN_DAEMON_TOKEN is required — set it before starting the daemon')
    process.exit(1)
  }
  return randomBytes(32).toString('hex')
}

// Constant-time check over fixed-length sha256 digests (timingSafeEqual demands
// equal lengths, and hashing removes any length signal from the secret itself).
const tokenHash = createHash('sha256').update(resolveToken()).digest()

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
// live on the WS session).
const server = createServer(async (req, res) => {
  const cors = corsHeaders(req)
  try {
    const url = req.url ?? '/'
    if (!url.startsWith('/trpc')) {
      res.writeHead(404, cors)
      res.end()
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
})

// The WS upgrade is token-gated by hand (noServer): browsers can open
// ws://127.0.0.1 from ANY page with no CORS check, so an unauthenticated
// /session would be a drive-by remote shell. The client requests subprotocol
// `porcelain.<token>`; ws's default protocol selection echoes the first offered
// subprotocol back, which the browser requires for the handshake to complete.
const wss = new WebSocketServer({ noServer: true })
const WS_PROTOCOL_PREFIX = 'porcelain.'

server.on('upgrade', (req, socket, head) => {
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
})

async function main(): Promise<void> {
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
