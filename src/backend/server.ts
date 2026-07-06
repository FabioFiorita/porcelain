import { createHash } from 'node:crypto'
import { router } from './api'
import { subscribeAppEvents } from './app-events'
import { initConfigDir, loadConfig } from './config-store'
import { createDaemonHttp } from './daemon-http'
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

// The session token, now a persistent shared secret (remote-environments Phase 2,
// replacing the per-app-run token the shell used to mint). The shell
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

// The whole request/upgrade pipeline lives in the factory (daemon-http.ts) so it
// can be booted for real in a test; the entry file only resolves its inputs. Built
// in main() (below) once the token is known — a `let` because the token resolves
// asynchronously (env or file), and the digest must exist before either listener
// accepts a connection (the factory takes it as input, so that ordering is now
// structural).
let daemon: ReturnType<typeof createDaemonHttp>

async function main(): Promise<void> {
  // Resolve the shared token (env or ~/.porcelain/daemon-token) and precompute its
  // digest BEFORE any listener accepts a connection — the factory closes over the
  // hash, so it must be built first (both listeners start below).
  const tokenHash = createHash('sha256')
    .update(await resolveToken())
    .digest()

  // CORS is scoped, not `*`: the shell passes the dev renderer's origin via
  // PORCELAIN_ALLOWED_ORIGIN (the Vite server); the packaged file:// renderer
  // sends a literal "null" origin the factory always echoes. See daemon-http.ts.
  daemon = createDaemonHttp({
    tokenHash,
    allowedOrigin: process.env.PORCELAIN_ALLOWED_ORIGIN ?? '',
    router,
    onSession: createSession,
    serveStatic,
  })

  // Hand the shared handlers to the tailnet-listener module so its optional second
  // listener (bound to the Tailscale interface, started/stopped live from the API)
  // behaves identically to loopback — same token gate, never 0.0.0.0.
  initTailnetHandlers(daemon.requestListener, daemon.handleUpgrade)

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
  daemon.server.listen(requestedPort, '127.0.0.1', () => {
    const address = daemon.server.address()
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
  // Escape hatch for the standalone daemon package (remote-environments Phase 4):
  // a supervisor like systemd hands stdin as /dev/null, which reads EOF
  // immediately and would kill the daemon on boot. PORCELAIN_NO_STDIN_WATCHDOG=1
  // opts out. FAIL CLOSED — the watchdog stays armed unless the var is exactly '1',
  // so the shell (which never sets it) keeps the orphan protection.
  if (process.env.PORCELAIN_NO_STDIN_WATCHDOG !== '1') {
    process.stdin.resume()
    process.stdin.on('end', () => process.exit(0))
    process.stdin.on('close', () => process.exit(0))
  }
}

main().catch((error) => {
  console.error('[daemon] failed to start:', error)
  process.exit(1)
})
